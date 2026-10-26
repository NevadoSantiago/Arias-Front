import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  getServerTime,
  markOrdersComandado,
  markOrdersEntregado,
  reprintOrder,
  undoOrderKitchenState,
} from '@/features/admin/services/adminApi';
import { buildKitchenBoard, type BoardOrder } from './kitchenBoard';

/** How often the order list is refetched (the backend commands PENDIENTE orders every minute). */
export const ORDERS_POLL_MS = 60_000;
/** How often the clock-dependent grouping is recomputed: once per minute, right when the minute changes. */
export const CLOCK_TICK_MS = 60_000;
/** The board countdowns tick every second. */
export const SECOND_TICK_MS = 1_000;
/** While any order is waiting for its ticket, poll fast so "En cola" turns into "Impresa" promptly. */
export const QUEUED_POLL_MS = 5_000;
/** The "Deshacer" bar after marking an order as delivered. */
export const UNDO_OTHER_MS = 20_000;
/** How long a reprinted order says "Enviada". */
export const REPRINT_FLASH_MS = 2_500;
/** Refresh rate of the undo countdown. */
const COUNTDOWN_TICK_MS = 250;

const ORDERS_KEY = ['adminOrdersByPickup'] as const;

const SERVER_TIME_KEY = ['adminServerTime'] as const;

interface UndoState {
  ids: number[];
  message: string;
  /** Epoch ms at which the bar disappears. */
  expiresAt: number;
}

/**
 * Reloj local, sin pedidos al backend: se actualiza en cada múltiplo de `intervalMs` del reloj
 * (con 60 s, justo cuando cambia el minuto), no cada `intervalMs` desde que se montó, así la
 * hora que se muestra nunca queda atrasada. Cada tick reprograma el siguiente para no acumular
 * desvío.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      id = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, intervalMs - (Date.now() % intervalMs));
    };
    schedule();
    return () => clearTimeout(id);
  }, [intervalMs]);
  return now;
}

function deliveredMessage(orders: Pick<BoardOrder, 'id'>[]): string {
  return orders.length === 1
    ? `Pedido N° ${orders[0].id} pasó a entregados`
    : `${orders.length} pedidos pasaron a entregados`;
}

/**
 * Offset between the server clock and the PC's, in ms. Read when the answer arrives; 0 (the local
 * clock) while it is unknown or when the request fails.
 */
function useServerOffset(): number {
  const serverTime = useQuery({
    queryKey: SERVER_TIME_KEY,
    queryFn: async () => ({ offsetMs: Date.parse((await getServerTime()).now) - Date.now() }),
    refetchOnWindowFocus: true,
    staleTime: 5 * 60_000,
  });
  const offset = serverTime.data?.offsetMs;
  return offset !== undefined && Number.isFinite(offset) ? offset : 0;
}

/** Local clock that re-renders every `intervalMs`. */
function useLocalClock(intervalMs: number): number {
  const [local, setLocal] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setLocal(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return local;
}

/** Container logic of the kitchen dashboard: data, live clock, moves and undo. */
export function useKitchenBoard({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const offsetMs = useServerOffset();
  const nowMs = useLocalClock(SECOND_TICK_MS) + offsetMs;
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [reprinted, setReprinted] = useState<ReadonlySet<number>>(() => new Set());
  const flashTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => getOrdersByPickup(),
    refetchInterval: (query) =>
      query.state.data?.some((o) => o.printStatus === 'QUEUED') ? QUEUED_POLL_MS : ORDERS_POLL_MS,
    enabled,
  });
  const config = useQuery({
    queryKey: ['adminRestaurantConfig'],
    queryFn: getRestaurantConfigAdmin,
  });

  const board = useMemo(() => {
    if (!orders.data || !config.data) return null;
    return buildKitchenBoard(orders.data, {
      nowMs,
      timezone: config.data.timezone,
      leadMinutes: config.data.pickupLeadMinutes,
    });
  }, [orders.data, config.data, nowMs]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY });

  const comandar = useMutation({
    mutationFn: (id: number) => markOrdersComandado([id]),
    onError: () => toast.error('No se pudo comandar el pedido. Revisá el tablero e intentá de nuevo.'),
    onSettled: refresh,
  });

  const entregar = useMutation({
    mutationFn: ({ ids }: { ids: number[]; message: string }) => markOrdersEntregado(ids),
    onSuccess: (_data, { ids, message }) => {
      const at = Date.now();
      setClock(at);
      setUndo({ ids, message, expiresAt: at + UNDO_OTHER_MS });
    },
    onError: () => toast.error('No se pudo actualizar el pedido. Revisá el tablero e intentá de nuevo.'),
    onSettled: refresh,
  });

  const undoMove = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => undoOrderKitchenState(id))),
    onSuccess: () => setUndo(null),
    onError: () => toast.error('No se pudo deshacer. Revisá el tablero e intentá de nuevo.'),
    onSettled: refresh,
  });

  const reprint = useMutation({
    mutationFn: (id: number) => reprintOrder(id),
    onSuccess: (_jobs, id) => {
      setReprinted((prev) => new Set(prev).add(id));
      const timer = setTimeout(() => {
        flashTimers.current.delete(timer);
        setReprinted((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, REPRINT_FLASH_MS);
      flashTimers.current.add(timer);
    },
    onError: () => toast.error('No se pudo reimprimir la comanda. Revisá el tablero e intentá de nuevo.'),
    onSettled: refresh,
  });

  useEffect(() => {
    if (!undo) return;
    const expire = setTimeout(() => setUndo(null), UNDO_OTHER_MS);
    const tick = setInterval(() => setClock(Date.now()), COUNTDOWN_TICK_MS);
    return () => {
      clearTimeout(expire);
      clearInterval(tick);
    };
  }, [undo]);

  useEffect(() => {
    const timers = flashTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  return {
    board,
    now,
    nowMs,
    timezone: config.data?.timezone ?? 'America/Argentina/Buenos_Aires',
    leadMinutes: config.data?.pickupLeadMinutes ?? 0,
    isLoading: orders.isLoading || config.isLoading,
    isError: orders.isError || config.isError,
    isFetching: orders.isFetching,
    refetch: () => {
      void orders.refetch();
      void config.refetch();
    },
    busy: comandar.isPending || entregar.isPending || undoMove.isPending,
    undo: undo && {
      ids: undo.ids,
      message: undo.message,
      secondsLeft: Math.max(0, Math.ceil((undo.expiresAt - clock) / 1000)),
    },
    queuedCount: orders.data?.filter((o) => o.printStatus === 'QUEUED').length ?? 0,
    reprinted,
    reprint: (order: Pick<BoardOrder, 'id'>) => reprint.mutate(order.id),
    dismissUndo: () => setUndo(null),
    runUndo: () => undo && undoMove.mutate(undo.ids),
    comandar: (order: Pick<BoardOrder, 'id'>) => comandar.mutate(order.id),
    entregar: (list: Pick<BoardOrder, 'id'>[]) =>
      entregar.mutate({ ids: list.map((o) => o.id), message: deliveredMessage(list) }),
  };
}
