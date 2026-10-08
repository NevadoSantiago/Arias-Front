import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  markOrdersComandado,
  markOrdersEntregado,
  undoOrderKitchenState,
} from '@/features/admin/services/adminApi';
import { buildKitchenBoard, slotAnchorFor, type BoardOrder } from './kitchenBoard';

/** How often the order list is refetched (the backend confirms PENDIENTE orders every minute). */
export const ORDERS_POLL_MS = 60_000;
/** How often the clock-dependent grouping is recomputed: once per minute, right when the minute changes. */
export const CLOCK_TICK_MS = 60_000;
/** How long the "Deshacer" bar stays after a move. */
const UNDO_VISIBLE_MS = 20_000;

const ORDERS_KEY = ['adminOrdersByPickup'] as const;

type MoveKind = 'comandar' | 'entregar';

interface UndoState {
  ids: number[];
  message: string;
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

function moveMessage(kind: MoveKind, orders: BoardOrder[]): string {
  const target = kind === 'comandar' ? 'comandados' : 'entregados';
  return orders.length === 1
    ? `Pedido N° ${orders[0].id} pasó a ${target}`
    : `${orders.length} pedidos pasaron a ${target}`;
}

/** Container logic of the kitchen dashboard: data, live clock, moves and undo. */
export function useKitchenBoard({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const now = useNow(CLOCK_TICK_MS);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => getOrdersByPickup(),
    refetchInterval: ORDERS_POLL_MS,
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
      kind === 'comandar' ? markOrdersComandado(ids) : markOrdersEntregado(ids),
    onSuccess: (_data, { ids, message }) => setUndo({ ids, message }),
    onError: () => toast.error('No se pudo actualizar el pedido. Revisá el tablero e intentá de nuevo.'),
    onSettled: refresh,
  });

  const undoMove = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => undoOrderKitchenState(id))),
    onSuccess: () => setUndo(null),
    onError: () => toast.error('No se pudo deshacer. Revisá el tablero e intentá de nuevo.'),
    onSettled: refresh,
  });

  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), UNDO_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [undo]);

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
    undo,
    dismissUndo: () => setUndo(null),
    runUndo: () => undo && undoMove.mutate(undo.ids),
    comandar: (list: BoardOrder[]) =>
      move.mutate({ kind: 'comandar', ids: list.map((o) => o.id), message: moveMessage('comandar', list) }),
    entregar: (list: BoardOrder[]) =>
      move.mutate({ kind: 'entregar', ids: list.map((o) => o.id), message: moveMessage('entregar', list) }),
  };
}
