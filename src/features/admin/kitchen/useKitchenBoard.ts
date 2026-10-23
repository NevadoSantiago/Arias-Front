import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  markOrdersComandado,
  markOrdersConfirmado,
  markOrdersEntregado,
  reprintOrder,
  undoOrderKitchenState,
} from '@/features/admin/services/adminApi';
import { buildKitchenBoard, slotAnchorFor, type BoardOrder } from './kitchenBoard';

/** How often the order list is refetched (the backend confirms PENDIENTE orders every minute). */
export const ORDERS_POLL_MS = 60_000;
/** How often the clock-dependent grouping is recomputed: once per minute, right when the minute changes. */
export const CLOCK_TICK_MS = 60_000;
/** While any order is waiting for its ticket, poll fast so "En cola" turns into "Impresa" promptly. */
export const QUEUED_POLL_MS = 5_000;
/** The "Deshacer" bar after COMANDAR: the print jobs only become claimable once it is over. */
export const UNDO_COMANDAR_MS = 10_000;
/** The "Deshacer" bar after every other move. */
export const UNDO_OTHER_MS = 20_000;
/** How long a reprinted order says "Enviada". */
export const REPRINT_FLASH_MS = 2_500;
/** Refresh rate of the undo countdown. */
const COUNTDOWN_TICK_MS = 250;

const ORDERS_KEY = ['adminOrdersByPickup'] as const;

type MoveKind = 'confirmar' | 'comandar' | 'entregar';

interface UndoState {
  ids: number[];
  message: string;
  kind: MoveKind;
  /** Epoch ms at which the bar disappears. */
  expiresAt: number;
}

const undoDuration = (kind: MoveKind) => (kind === 'comandar' ? UNDO_COMANDAR_MS : UNDO_OTHER_MS);

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

function moveMessage(kind: MoveKind, orders: BoardOrder[]): string {
  const target = kind === 'confirmar' ? 'confirmados' : kind === 'comandar' ? 'comandados' : 'entregados';
  return orders.length === 1
    ? `Pedido N° ${orders[0].id} pasó a ${target}`
    : `${orders.length} pedidos pasaron a ${target}`;
}

/** Container logic of the kitchen dashboard: data, live clock, moves and undo. */
export function useKitchenBoard({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const now = useNow(CLOCK_TICK_MS);
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
      now,
      timezone: config.data.timezone,
      leadMinutes: config.data.pickupLeadMinutes,
      slotMinutes: config.data.pickupSlotMinutes,
      slotAnchorMinutes: slotAnchorFor(config.data.pickupSchedule, now, config.data.timezone),
    });
  }, [orders.data, config.data, now]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY });

  const move = useMutation({
    mutationFn: ({ kind, ids }: { kind: MoveKind; ids: number[]; message: string }) =>
      kind === 'confirmar'
        ? markOrdersConfirmado(ids)
        : kind === 'comandar'
          ? markOrdersComandado(ids)
          : markOrdersEntregado(ids),
    // Confirming consumes credits and has no undo endpoint, so it never raises the undo bar.
    onSuccess: (_data, { kind, ids, message }) => {
      if (kind !== 'confirmar') {
        const now = Date.now();
        setClock(now);
        setUndo({ ids, message, kind, expiresAt: now + undoDuration(kind) });
      }
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
    const expire = setTimeout(() => setUndo(null), undoDuration(undo.kind));
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
    timezone: config.data?.timezone ?? 'America/Argentina/Buenos_Aires',
    leadMinutes: config.data?.pickupLeadMinutes ?? 0,
    slotMinutes: config.data?.pickupSlotMinutes ?? 0,
    isLoading: orders.isLoading || config.isLoading,
    isError: orders.isError || config.isError,
    isFetching: orders.isFetching,
    refetch: () => {
      void orders.refetch();
      void config.refetch();
    },
    busy: move.isPending || undoMove.isPending,
    undo: undo && {
      ids: undo.ids,
      message: undo.message,
      kind: undo.kind,
      secondsLeft: Math.max(0, Math.ceil((undo.expiresAt - clock) / 1000)),
    },
    queuedCount: orders.data?.filter((o) => o.printStatus === 'QUEUED').length ?? 0,
    reprinted,
    reprint: (order: Pick<BoardOrder, 'id'>) => reprint.mutate(order.id),
    dismissUndo: () => setUndo(null),
    runUndo: () => undo && undoMove.mutate(undo.ids),
    confirmar: (list: BoardOrder[]) =>
      move.mutate({ kind: 'confirmar', ids: list.map((o) => o.id), message: moveMessage('confirmar', list) }),
    comandar: (list: BoardOrder[]) =>
      move.mutate({ kind: 'comandar', ids: list.map((o) => o.id), message: moveMessage('comandar', list) }),
    entregar: (list: BoardOrder[]) =>
      move.mutate({ kind: 'entregar', ids: list.map((o) => o.id), message: moveMessage('entregar', list) }),
  };
}
