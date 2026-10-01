import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Clock, UtensilsCrossed } from 'lucide-react';
import { DishCard } from '@/features/orders/components/DishCard';
import { FilterPills } from '@/features/orders/components/FilterPills';
import type { ActiveFilter } from '@/features/orders/components/FilterPills';
import { WeekDaySelector } from '@/features/orders/components/WeekDaySelector';
import { CancelOrderSheet } from '@/features/orders/components/CancelOrderSheet';
import { RemoveOrderItemSheet } from '@/features/orders/components/RemoveOrderItemSheet';
import { CartBar } from '@/features/orders/components/b2c/CartBar';
import { DishSheet } from '@/features/orders/components/b2c/DishSheet';
import { EmptyBalanceCard } from '@/features/orders/components/b2c/EmptyBalanceCard';
import { OrderConfirmedView } from '@/features/orders/components/b2c/OrderConfirmedView';
import { comandaFooter, comandaItems, isPaidWithMercadoPago } from '@/features/orders/components/b2c/comandaModel';
import { OrderPayDirectSheet } from '@/features/orders/components/b2c/OrderPayDirectSheet';
import { OrderReviewPanel } from '@/features/orders/components/b2c/OrderReviewPanel';
import { OrderReviewSheet } from '@/features/orders/components/b2c/OrderReviewSheet';
import type { OrderReviewProps } from '@/features/orders/components/b2c/orderReviewProps';
import { SelectedDayOrders } from '@/features/orders/components/b2c/SelectedDayOrders';
import { formatOrderTimeLabel } from '@/features/orders/components/orderDateLabels';
import { useCancelOrder } from '@/features/orders/hooks/useCancelOrder';
import { useCart } from '@/features/orders/hooks/useCart';
import { usePayNow } from '@/features/orders/hooks/usePayNow';
import { useRemoveOrderItem } from '@/features/orders/hooks/useRemoveOrderItem';
import {
  addOrderItemsV2,
  BalanceCoversOrderError,
  DirectCheckoutUnavailableError,
  getAvailableDishes,
  getDisabledDates,
  getMenuSections,
  getOrdersV2,
  getRestaurantConfig,
  InsufficientCreditsError,
  OrderNotModifiableError,
  placeOrderV2,
  startDirectCheckoutV2,
} from '@/features/orders/services/ordersApi';
import type { OrderV2 } from '@/features/orders/services/ordersApi';
import type { Dish, RestaurantConfig } from '@/features/orders/types';
import { useWallet } from '@/features/credits/hooks/useWallet';
import { resolveCallName } from '@/features/auth/lib/callName';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { useAuthStore } from '@/features/auth/store/authStore';
import { cn } from '@/lib/utils';

/**
 * Copia de `formatDayLabel` (`CompanyOrderPage.tsx`) — se duplica a propósito
 * en vez de importarla desde ahí: `CompanyOrderPage` es el flujo B2B, que no
 * debe cambiar ni depender de un archivo B2C (restricción del documento de
 * la feature).
 */
function formatDayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const formatted = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Igual que `formatDayLabel`, con el mes — solo para el ticket de confirmación (F4). */
function formatDayLongLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const formatted = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Día ISO de la semana (1..7, 1 = lunes) de una fecha "YYYY-MM-DD" — parseada
 * como fecha LOCAL (mismo patrón de `formatDayLabel`, `+ 'T12:00:00'`) para
 * no correr el día por el corrimiento de huso horario que tendría
 * `new Date('YYYY-MM-DD')` (UTC medianoche) cerca de la medianoche local (F14b).
 */
function isoWeekdayOf(date: string): number {
  const day = new Date(date + 'T12:00:00').getDay(); // 0 = domingo .. 6 = sábado
  return day === 0 ? 7 : day;
}

type PickupWindowDisplay = { kind: 'open'; start: string; end: string } | { kind: 'closed' } | null;

/**
 * Franja de retiro a mostrar para el día SELECCIONADO (F14b) — reemplaza el
 * par global deprecated `pickupWindowStart/End` (F2/F3.1) por
 * `pickupSchedule` del día de la semana correspondiente. Tolerante a un
 * backend viejo sin `pickupSchedule`: cae al par global, y si tampoco está,
 * no muestra nada (mismo comportamiento que antes de F14).
 */
function pickupWindowDisplayFor(config: RestaurantConfig | undefined, selectedDate: string): PickupWindowDisplay {
  if (!config) return null;
  const day = config.pickupSchedule?.find((d) => d.dayOfWeek === isoWeekdayOf(selectedDate));
  if (day) {
    if (day.open && day.windowStart && day.windowEnd) {
      return { kind: 'open', start: day.windowStart, end: day.windowEnd };
    }
    return { kind: 'closed' };
  }
  if (config.pickupWindowStart && config.pickupWindowEnd) {
    return { kind: 'open', start: config.pickupWindowStart, end: config.pickupWindowEnd };
  }
  return null;
}

interface DoneData {
  isToday: boolean;
  dayLongLabel: string;
  pickupTimeLabel: string;
  /** El pedido tal como lo devolvió el backend (nuevo, o el existente con los platos sumados). */
  order: OrderV2;
  /** Platos sumados a un pedido existente; null = pedido nuevo. */
  addedPlates: number | null;
  /** Ids de los ítems que este envío agregó (marca "Nuevo"). */
  newItemIds: ReadonlySet<number>;
  /** Almuerzos que este envío reservó (el pedido entero, o solo lo sumado). */
  reservedLunches: number;
  walletAvailableAfter: number | null;
}

/**
 * Pantalla de pedido para clientes B2C (sin empresa) — carrito multi-ítem,
 * horario de retiro y confirmación contra `POST /api/v2/orders`. `TodayOrderPage`
 * decide si renderiza esta pantalla o `CompanyOrderPage` según `user.companyId`.
 *
 * Costo en "almuerzos" — NUNCA "créditos" (proposal `b2c-credits-pivot`,
 * "Vocabulario") — y NUNCA calculado en el cliente: el total del carrito sale
 * de `dish.category.creditCost` (reportado por el backend), y el rechazo por
 * saldo insuficiente siempre lo decide el backend (`InsufficientCreditsError`).
 *
 * F4 (prototipo aprobado): el detalle de plato y la revisión del pedido son
 * hojas inferiores (`DishSheet`, `OrderReviewSheet`) en vez de estar siempre
 * visibles; la confirmación es una vista tipo ticket (`OrderConfirmedView`)
 * en vez de un toast efímero (F20: la comanda del pedido).
 */
export function B2cOrderPage() {
  const user = useAuthStore((s) => s.user);
  /** Escritorio (≥1024px): panel fijo "Tu pedido" y diálogos en vez de barra inferior y hojas (F22a). */
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [reviewOpen, setReviewOpen] = useState(false);
  /**
   * Horario de retiro elegido, atado a la fecha para la que se eligió.
   * Se guarda junto con esa fecha (en vez de resetear con un efecto al
   * cambiar `selectedDate`) para que cambiar de día invalide el horario de
   * forma derivada, sin un `useEffect` que dispare un segundo render.
   */
  const [pickupSelection, setPickupSelection] = useState<{ date: string; time: string } | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<DoneData | null>(null);
  /**
   * "Pagá este pedido con Mercado Pago" (F18) — se abre cuando `placeOrderV2`
   * rechaza un pedido NUEVO (no "agregar al pedido") con
   * `InsufficientCreditsError`. Independiente de `insufficientBalance`, que
   * sigue siendo el aviso inline de "agregar al pedido" (sin cambios).
   */
  const [payDirectOpen, setPayDirectOpen] = useState(false);
  const [payingDirect, setPayingDirect] = useState(false);
  const [payDirectError, setPayDirectError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  /**
   * "Agregar platos" desde la comanda de "Mis pedidos" (F20) abre esta pantalla
   * con `?fecha=AAAA-MM-DD&hora=<ISO>`: arranca en ese día y, con la hoja de
   * revisión, en ese horario (el mismo salto que "Sumarlo al pedido de las
   * HH:MM"). Un `fecha` que no es una fecha, o ya pasó, se ignora.
   */
  const requestedDate = searchParams.get('fecha');
  const requestedDayIsValid =
    requestedDate !== null && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= todayStr;
  const requestedTime = requestedDayIsValid ? searchParams.get('hora') : null;
  /** Atajo "Sumarlo al pedido de las HH:MM" de la hoja de revisión (F21): cada objeto nuevo mueve el selector de horario. */
  const [pickupJumpTo, setPickupJumpTo] = useState<{ pickupAt: string } | null>(
    requestedTime && !Number.isNaN(new Date(requestedTime).getTime()) ? { pickupAt: requestedTime } : null,
  );
  const [selectedDate, setSelectedDate] = useState(requestedDayIsValid ? requestedDate : todayStr);

  const cart = useCart(selectedDate);

  const { data: sections } = useQuery({ queryKey: ['menuSections'], queryFn: getMenuSections });

  const { data: disabledDatesData } = useQuery({
    queryKey: ['disabledDates'],
    queryFn: () => getDisabledDates(),
  });
  const disabledDates = useMemo(
    () => new Set(disabledDatesData?.map((d) => d.fecha) ?? []),
    [disabledDatesData],
  );

  const { data: dishes, isLoading: loadingDishes } = useQuery({
    queryKey: ['availableDishes', selectedDate],
    queryFn: () => getAvailableDishes(selectedDate),
  });

  const { data: config } = useQuery({ queryKey: ['restaurantConfig'], queryFn: getRestaurantConfig });

  /**
   * Saldo de almuerzos — solo para mostrar (tarjeta de saldo cero, cálculo
   * "Te quedan N"); nunca decide si se puede confirmar. Usa `useWallet`
   * (clave `['creditsWallet']`) para compartir la misma caché que el chip
   * del header y `CreditsPacksPage` — antes esta pantalla usaba
   * `['creditWallet']`, una clave distinta que dejaba el chip desactualizado
   * tras confirmar un pedido (F7.1).
   */
  const { data: wallet } = useWallet();

  /**
   * Pedidos del cliente — solo para pintar el tilde de "día con pedido" en
   * `WeekDaySelector`. Los cancelados NO cuentan como "con pedido" (decisión
   * F2, spec de la feature).
   */
  const { data: myOrders } = useQuery({ queryKey: ['ordersV2'], queryFn: getOrdersV2 });
  const orderedDates = useMemo(
    () => new Set((myOrders ?? []).filter((o) => o.estado !== 'CANCELADO').map((o) => o.fecha)),
    [myOrders],
  );

  /**
   * Pedido(s) NO cancelados del día seleccionado — "Tu pedido para <día>"
   * (F15, pedido del usuario: un día con pedido programado no mostraba
   * forma de verlo ni modificarlo). `now` se calcula una vez por carga de
   * `myOrders` para las etiquetas de `OrderCard`, igual que `MyOrdersPage`.
   */
  const now = useMemo(() => new Date(), [myOrders]);
  const ordersForSelectedDay = useMemo(
    () => (myOrders ?? []).filter((o) => o.fecha === selectedDate && o.estado !== 'CANCELADO'),
    [myOrders, selectedDate],
  );
  const { cancelTarget, cancelError, cancelling, requestCancel, closeSheet, confirmCancel } =
    useCancelOrder();
  const {
    removeTarget,
    removeError,
    removing,
    requestRemoveItem,
    closeRemoveSheet,
    confirmRemoveItem,
  } = useRemoveOrderItem();
  const { payingOrderId, payNow } = usePayNow();

  const isToday = selectedDate === todayStr;
  const dayShortLabel = formatDayLabel(selectedDate).toLowerCase();
  const dayHeadingLabel = isToday ? 'hoy' : dayShortLabel;

  /**
   * Hora local "HH:MM" del último pedido NO cancelado (mayor `id`) — decisión
   * F2/F3 de la feature. Sin columna nueva: se deriva de `getOrdersV2` acá
   * mismo, y se pasa como una hora suelta (no una fecha) porque
   * `PickupTimePicker` la compara contra los slots del día seleccionado.
   */
  const lastUsedTimeOfDay = useMemo(() => {
    const nonCancelled = (myOrders ?? []).filter((o) => o.estado !== 'CANCELADO');
    if (nonCancelled.length === 0) return null;
    const latest = nonCancelled.reduce((a, b) => (b.id > a.id ? b : a));
    const d = new Date(latest.pickupAt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [myOrders]);

  const pickupAt = pickupSelection?.date === selectedDate ? pickupSelection.time : null;
  const pickupTimeLabel = pickupAt
    ? (() => {
        const d = new Date(pickupAt);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })()
    : null;
  /**
   * Regla de pedidos del mismo día (F21, decisión del usuario): si el
   * horario elegido es IGUAL al de un pedido `modifiable` del día, el
   * carrito se AGREGA a ese pedido; con cualquier otro horario se crea un
   * pedido NUEVO y el existente no cambia. `modifiable` lo decide siempre el
   * backend (B10): un pedido `PENDIENTE_PAGO` o pagado aparte con Mercado
   * Pago es cancelable pero no admite platos, así que nunca es el destino.
   */
  const pickupMillis = pickupAt ? new Date(pickupAt).getTime() : null;
  const samePickup = (order: { pickupAt: string }) =>
    pickupMillis !== null && new Date(order.pickupAt).getTime() === pickupMillis;
  const modifiableOrderForSelectedDay =
    ordersForSelectedDay.find((o) => o.modifiable && samePickup(o)) ?? null;
  const lockedSameTimeOrder =
    modifiableOrderForSelectedDay ? null : (ordersForSelectedDay.find((o) => !o.modifiable && samePickup(o)) ?? null);
  const joinableOrder = ordersForSelectedDay.find((o) => o.modifiable) ?? null;
  const newOrderNotice =
    ordersForSelectedDay.length > 0 && !modifiableOrderForSelectedDay
      ? {
          otherPickupAts: ordersForSelectedDay.map((o) => o.pickupAt),
          lockedSamePickupAt: lockedSameTimeOrder?.pickupAt ?? null,
          joinablePickupAt: joinableOrder?.pickupAt ?? null,
        }
      : null;

  /**
   * Corrección de revisión: si `handleAddToOrder` falla con
   * `OrderNotModifiableError`, `submitError` queda con el mensaje "armá uno
   * nuevo" mientras se refetchea `ordersV2`. Cuando ese refetch llega y
   * `modifiableOrderForSelectedDay` pasa de haber un pedido a no haberlo, la
   * hoja cae sola a modo "pedido nuevo" — pero el mensaje viejo seguía
   * mostrándose ahí, ya sin sentido. Se limpia ajustando el estado durante el
   * render (patrón de React para "adjusting state when a prop changes"),
   * comparando con el id anterior en vez de un `useEffect` que dispararía un
   * segundo render.
   */
  const [prevModifiableOrderId, setPrevModifiableOrderId] = useState<number | null>(null);
  const modifiableOrderId = modifiableOrderForSelectedDay?.id ?? null;
  if (modifiableOrderId !== prevModifiableOrderId) {
    if (prevModifiableOrderId !== null && modifiableOrderId === null) {
      setSubmitError(null);
    }
    setPrevModifiableOrderId(modifiableOrderId);
  }

  const confirmLabel = modifiableOrderForSelectedDay
    ? `Sumar a mi pedido de las ${formatOrderTimeLabel(modifiableOrderForSelectedDay.pickupAt)}`
    : pickupTimeLabel
      ? isToday
        ? `Retiro hoy ${pickupTimeLabel} hs`
        : `Retiro ${dayShortLabel} a las ${pickupTimeLabel}`
      : 'Confirmar pedido';

  const specialDishes = useMemo(() => dishes?.filter((d) => d.especial) ?? [], [dishes]);
  const regularDishes = useMemo(() => dishes?.filter((d) => !d.especial) ?? [], [dishes]);

  const counts = useMemo(() => {
    const map: Record<number | 'all', number> = { all: regularDishes.length };
    sections?.forEach((s) => {
      map[s.id] = regularDishes.filter((d) => d.menuSection.id === s.id).length;
    });
    return map;
  }, [regularDishes, sections]);

  const groupedBySection = useMemo(() => {
    if (!regularDishes.length || !sections) return [];
    return sections
      .map((s) => ({
        section: s,
        dishes: regularDishes.filter((d) => d.menuSection.id === s.id),
      }))
      .filter((g) => g.dishes.length > 0);
  }, [regularDishes, sections]);

  const canConfirm = cart.lines.length > 0 && !!pickupAt && !submitting;

  const handleAddToCart = (selection: { sideId: number | null; notas: string | null }) => {
    if (!selectedDish) return;
    const side = selection.sideId
      ? selectedDish.allowedSides.find((s) => s.id === selection.sideId) ?? null
      : null;
    cart.addItem({
      dish: selectedDish,
      sideId: selection.sideId,
      sideNombre: side?.nombre ?? null,
      notas: selection.notas,
    });
    setSelectedDish(null);
  };

  /**
   * Cambiar de día cierra la hoja de revisión: el carrito es por día (F12),
   * así que el día nuevo puede estar vacío y `reviewOpen` seguiría en
   * `true` si no se resetea acá — igual que F7.1, si después se agrega un
   * plato en ese día nuevo, `reviewOpen && cart.lines.length > 0` la
   * reabriría sola sin que el usuario tocara "Ver pedido". Se resuelve en
   * el handler, no con un efecto.
   */
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setReviewOpen(false);
    setPickupJumpTo(null);
  };

  /**
   * Quitar la última línea vacía el carrito y debe cerrar la hoja de
   * revisión: antes `reviewOpen` seguía en `true` (solo se ocultaba por
   * `reviewOpen && cart.lines.length > 0` en el `open` de la hoja), así que
   * agregar el próximo plato la reabría sin que el usuario lo pidiera
   * (F7.1). Se resuelve acá, en el handler, no con un efecto.
   */
  const handleRemoveLine = (localId: string) => {
    cart.removeItem(localId);
    if (cart.lines.length === 1) {
      setReviewOpen(false);
    }
  };

  const handleConfirm = async () => {
    if (!pickupAt) return;
    setSubmitError(null);
    setInsufficientBalance(false);
    setSubmitting(true);
    // Snapshot ANTES de limpiar el carrito — la comanda de confirmación muestra
    // el total que se acaba de reservar.
    const totalSnapshot = cart.totalCredits;
    try {
      const placed = await placeOrderV2({
        items: cart.lines.map((line) => ({
          dishId: line.dish.id,
          sideId: line.sideId,
          notas: line.notas,
        })),
        pickupAt,
        notas: null,
      });
      cart.clear();
      setPickupSelection(null);
      setPickupJumpTo(null);
      setReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      setDone({
        isToday,
        dayLongLabel: formatDayLongLabel(selectedDate),
        pickupTimeLabel: pickupTimeLabel!,
        order: placed,
        addedPlates: null,
        newItemIds: new Set(),
        reservedLunches: totalSnapshot,
        walletAvailableAfter: wallet ? wallet.available - totalSnapshot : null,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        // F18: en un pedido NUEVO, el saldo insuficiente ofrece pagar
        // directo con Mercado Pago en vez de solo avisar — el servidor
        // sigue decidiendo (se intentó `placeOrderV2` primero). En "agregar
        // al pedido" el aviso inline de siempre no cambia (`handleAddToOrder`).
        setPayDirectError(null);
        setReviewOpen(false);
        setPayDirectOpen(true);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Ocurrió un error al confirmar el pedido.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * "Pagar $X con Mercado Pago" en la hoja de pago directo (F18, backend B7)
   * — mismo body que `handleConfirm`, pero crea el pedido `PENDIENTE_PAGO`
   * (sin comprometer saldo) junto a la compra DIRECT y redirige a Mercado
   * Pago. El carrito se vacía ANTES de redirigir (unidad F18, pedido del
   * usuario), igual que un pedido confirmado normal.
   */
  const handlePayDirect = async () => {
    if (!pickupAt) return;
    setPayDirectError(null);
    setPayingDirect(true);
    try {
      const checkout = await startDirectCheckoutV2({
        items: cart.lines.map((line) => ({
          dishId: line.dish.id,
          sideId: line.sideId,
          notas: line.notas,
        })),
        pickupAt,
        notas: null,
      });
      cart.clear();
      window.location.href = checkout.initPoint;
    } catch (err) {
      if (err instanceof BalanceCoversOrderError) {
        // F23: el saldo que vio el cliente estaba desactualizado y ya alcanza
        // para todo el pedido — no hay nada que cobrar. Se vuelve a la revisión
        // con el motivo y el saldo real, y el cliente lo confirma con su saldo
        // (nunca se gasta el saldo sin que lo vea).
        queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
        setPayDirectOpen(false);
        setPayDirectError(null);
        setSubmitError(err.message);
        setReviewOpen(true);
        return;
      }
      setPayDirectError(
        err instanceof DirectCheckoutUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No pudimos iniciar el pago.',
      );
    } finally {
      setPayingDirect(false);
    }
  };

  /**
   * Agrega el carrito del día al pedido modificable existente en vez de
   * armar uno nuevo (F16, backend B6 — `POST /api/v2/orders/{id}/items`).
   * Termina en la comanda de ese pedido (F20, como el prototipo), con los
   * platos sumados marcados "Nuevo".
   */
  const handleAddToOrder = async () => {
    if (!modifiableOrderForSelectedDay) return;
    setSubmitError(null);
    setInsufficientBalance(false);
    setSubmitting(true);
    const count = cart.lines.length;
    const totalSnapshot = cart.totalCredits;
    const previousItemIds = new Set(modifiableOrderForSelectedDay.items.map((item) => item.id));
    try {
      const updated = await addOrderItemsV2(
        modifiableOrderForSelectedDay.id,
        cart.lines.map((line) => ({
          dishId: line.dish.id,
          sideId: line.sideId,
          notas: line.notas,
        })),
      );
      cart.clear();
      setPickupJumpTo(null);
      setReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      setDone({
        isToday,
        dayLongLabel: formatDayLongLabel(selectedDate),
        pickupTimeLabel: formatOrderTimeLabel(updated.pickupAt),
        order: updated,
        addedPlates: count,
        newItemIds: new Set(updated.items.filter((item) => !previousItemIds.has(item.id)).map((item) => item.id)),
        reservedLunches: totalSnapshot,
        walletAvailableAfter: wallet ? wallet.available - totalSnapshot : null,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        setInsufficientBalance(true);
      } else if (err instanceof OrderNotModifiableError) {
        // El pedido dejó de ser modificable mientras la hoja estaba abierta
        // (p. ej. se cerró la ventana de cancelación) — se avisa y se
        // refetchea `ordersV2`, así `modifiableOrderForSelectedDay` deja de
        // encontrarlo y la hoja cae sola al modo de pedido nuevo.
        setSubmitError(err.message);
        queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Ocurrió un error al agregar los platos.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewConfirm = () => {
    if (modifiableOrderForSelectedDay) {
      void handleAddToOrder();
    } else {
      void handleConfirm();
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loadingDishes || !user || !sections) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  // ─── Confirmado ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="container max-w-xl py-8 lg:max-w-6xl lg:py-12">
        <OrderConfirmedView
          isToday={done.isToday}
          dayLongLabel={done.dayLongLabel}
          pickupTimeLabel={done.pickupTimeLabel}
          orderId={done.order.id}
          callName={resolveCallName(user)}
          items={comandaItems(done.order, { newItemIds: done.newItemIds })}
          footer={comandaFooter(done.order, { now, justPlaced: true })}
          paidWithMercadoPago={isPaidWithMercadoPago(done.order)}
          addedPlates={done.addedPlates}
          onBackToMenu={() => setDone(null)}
        />
      </div>
    );
  }

  // Mismos datos y handlers para la hoja móvil y el panel de escritorio: solo cambia el layout.
  const reviewProps: OrderReviewProps = {
    isToday,
    dayShortLabel,
    fecha: selectedDate,
    lastUsedTimeOfDay,
    onSelectPickup: (time) => setPickupSelection({ date: selectedDate, time }),
    addToOrder: modifiableOrderForSelectedDay ? { pickupAt: modifiableOrderForSelectedDay.pickupAt } : null,
    pickupTimeLabel,
    newOrderNotice,
    pickupJumpTo,
    onJoinOrder: (time) => setPickupJumpTo({ pickupAt: time }),
    lines: cart.lines,
    totalLunches: cart.totalCredits,
    onRemoveLine: handleRemoveLine,
    walletAvailable: wallet?.available ?? null,
    confirmLabel,
    canConfirm,
    submitting,
    submitError,
    insufficientBalance,
    onConfirm: handleReviewConfirm,
  };

  return (
    <div className="flex flex-col">
      <div className="container flex-1 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10 lg:py-12">
        <div className="min-w-0">
          <header className="mb-6 lg:mb-8">
            <h1 className="font-display text-foreground text-3xl lg:text-5xl font-bold leading-tight mb-1 lg:mb-2">
              {isToday ? `¡Buen día, ${user.firstName}!` : `Planificá tu comida del ${formatDayLabel(selectedDate)}`}
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              {isToday ? '¿Qué querés comer hoy?' : '¿Qué querés comer?'}
            </p>
          </header>

          {wallet && wallet.available === 0 && (
            <div className="mb-6">
              <EmptyBalanceCard />
            </div>
          )}

          <div className="mb-6 space-y-3">
            <WeekDaySelector
              selectedDate={selectedDate}
              onSelect={handleSelectDate}
              orderedDates={orderedDates}
              disabledDates={disabledDates}
              includeWeekendToday
              fitColumn
            />

            <div className="flex items-center justify-between gap-3 px-1">
              <span
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold',
                  isToday
                    ? 'bg-primary-deep text-primary-foreground'
                    : 'border border-foreground text-foreground',
                )}
              >
                {isToday ? (
                  <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {isToday ? 'Menú de hoy' : 'Pedido programado'}
              </span>

              {(() => {
                const windowDisplay = pickupWindowDisplayFor(config, selectedDate);
                if (!windowDisplay) return null;
                return (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-primary-deep" aria-hidden="true" />
                    {windowDisplay.kind === 'open' ? (
                      <span>
                        <span className="sr-only">Horario de retiro: </span>
                        {windowDisplay.start} – {windowDisplay.end}
                      </span>
                    ) : (
                      <span>Cerrado ese día</span>
                    )}
                  </span>
                );
              })()}
            </div>
          </div>

          <SelectedDayOrders
            orders={ordersForSelectedDay}
            dayHeadingLabel={dayHeadingLabel}
            now={now}
            onRequestCancel={requestCancel}
            onRequestRemoveItem={requestRemoveItem}
            pickupLeadMinutes={config?.pickupLeadMinutes}
            onRequestPayNow={(order) => payNow(order.id)}
            payingOrderId={payingOrderId}
          />

          <div className="mb-8 sticky top-0 z-20 bg-background py-2 -mt-2">
            <FilterPills
              sections={sections}
              active={activeFilter}
              counts={counts}
              onChange={setActiveFilter}
            />
          </div>

          {groupedBySection.length === 0 && specialDishes.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground text-sm uppercase tracking-brand">
                No hay platos disponibles
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {specialDishes.length > 0 && (
                <section>
                  <h2 className="font-display text-primary text-xl lg:text-2xl font-bold mb-4 border-b border-primary pb-2">
                    Especiales del día
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-3 sm:gap-5">
                    {specialDishes.map((dish) => (
                      <DishCard key={dish.id} dish={dish} onSelect={setSelectedDish} hideStock={!isToday} />
                    ))}
                  </div>
                </section>
              )}
              {groupedBySection.map(({ section, dishes: sectionDishes }) => (
                <section key={section.id} id={`section-${section.id}`}>
                  <h2 className="font-display text-foreground text-xl lg:text-2xl font-bold mb-4 border-b border-border pb-2">
                    {section.nombre}
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-3 sm:gap-5">
                    {sectionDishes.map((dish) => (
                      <DishCard key={dish.id} dish={dish} onSelect={setSelectedDish} hideStock={!isToday} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        {isDesktop && <OrderReviewPanel {...reviewProps} />}
      </div>

      {!isDesktop && (
        <div className="sticky bottom-0 z-20 bg-background">
          <div className="container max-w-xl px-0">
            <CartBar
              count={cart.lines.length}
              totalLunches={cart.totalCredits}
              isToday={isToday}
              dayLabel={dayShortLabel}
              onOpenReview={() => setReviewOpen(true)}
            />
          </div>
        </div>
      )}

      <DishSheet
        dish={selectedDish}
        open={!!selectedDish}
        onClose={() => setSelectedDish(null)}
        onConfirm={handleAddToCart}
        presentation={isDesktop ? 'dialog' : 'sheet'}
      />

      {!isDesktop && (
        <OrderReviewSheet
          open={reviewOpen && cart.lines.length > 0}
          onClose={() => {
            setReviewOpen(false);
            // El salto del atajo es de una sola vez: no sobrevive al cierre.
            setPickupJumpTo(null);
          }}
          {...reviewProps}
        />
      )}

      <OrderPayDirectSheet
        open={payDirectOpen}
        onClose={() => {
          // "Volver" cierra la hoja y conserva el carrito — reabre la
          // revisión, de donde salió (F18, pedido del usuario).
          setPayDirectOpen(false);
          setPayDirectError(null);
          setReviewOpen(true);
        }}
        pickupLabel={confirmLabel}
        lines={cart.lines}
        totalLunches={cart.totalCredits}
        walletAvailable={wallet?.available ?? 0}
        onPay={handlePayDirect}
        paying={payingDirect}
        payError={payDirectError}
        presentation={isDesktop ? 'dialog' : 'sheet'}
      />

      <CancelOrderSheet
        order={cancelTarget}
        now={now}
        cancelling={cancelling}
        errorMessage={cancelError}
        onConfirm={confirmCancel}
        onClose={closeSheet}
      />

      <RemoveOrderItemSheet
        target={removeTarget}
        removing={removing}
        errorMessage={removeError}
        onConfirm={confirmRemoveItem}
        onClose={closeRemoveSheet}
      />
    </div>
  );
}
