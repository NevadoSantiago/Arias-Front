import type { CartLine } from '../../hooks/useCart';

/** Props de la revisión del pedido: las comparten la hoja móvil y el panel de escritorio. */
export interface OrderReviewProps {
  isToday: boolean;
  dayShortLabel: string;
  fecha: string;
  lastUsedTimeOfDay: string | null;
  onSelectPickup: (pickupAt: string) => void;
  /**
   * Pedido modificable del día cuyo horario es IGUAL al elegido (F16, F21) —
   * cuando no es `null`, la hoja agrega el carrito a ESE pedido en vez de
   * armar uno nuevo, con el aviso "Se agrega a tu pedido de las HH:MM". El
   * selector de horario queda siempre visible. `B2cOrderPage` decide si hay
   * un pedido al que sumar — nunca esta hoja.
   */
  addToOrder: { pickupAt: string } | null;
  /** Horario elegido, "HH:MM" — para el título "Nuevo pedido a las HH:MM". `null` mientras cargan los horarios. */
  pickupTimeLabel: string | null;
  /**
   * Aviso de pedido NUEVO cuando el día ya tiene pedidos (F21); `null` si el
   * día no tiene pedidos o el carrito se suma a uno (`addToOrder`).
   * `otherPickupAts`: pedidos del día que quedan como están;
   * `lockedSamePickupAt`: el horario elegido coincide con un pedido NO
   * modificable (esperando pago o pagado aparte); `joinablePickupAt`: horario
   * de un pedido modificable al que el atajo permite volver.
   */
  newOrderNotice: {
    otherPickupAts: string[];
    lockedSamePickupAt: string | null;
    joinablePickupAt: string | null;
  } | null;
  /** Pedido de salto de horario para el selector (atajo "Sumarlo al pedido de las HH:MM"). */
  pickupJumpTo: { pickupAt: string } | null;
  onJoinOrder: (pickupAt: string) => void;
  lines: CartLine[];
  totalLunches: number;
  onRemoveLine: (localId: string) => void;
  /** Saldo disponible de la wallet — solo para mostrar el cálculo, nunca para decidir si se puede confirmar. */
  walletAvailable: number | null;
  confirmLabel: string;
  canConfirm: boolean;
  submitting: boolean;
  submitError: string | null;
  insufficientBalance: boolean;
  onConfirm: () => void;
}
