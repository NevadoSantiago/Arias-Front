import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CancelOrderSheet } from '@/features/orders/components/CancelOrderSheet';
import { ChangePickupTimeSheet } from '@/features/orders/components/ChangePickupTimeSheet';
import { MyOrdersSidePanel } from '@/features/orders/components/b2c/MyOrdersSidePanel';
import { OrderAccordionItem } from '@/features/orders/components/b2c/OrderAccordionItem';
import { OrderNoticeBanner } from '@/features/orders/components/b2c/OrderNoticeBanner';
import { WeekSwitch, WeekView } from '@/features/orders/components/b2c/WeekViews';
import { buildOrderWeeks, weekKeyOfOrder, type WeekKey } from '@/features/orders/components/b2c/myOrdersWeeks';
import { isRestaurantDayOnOrAfter } from '@/features/orders/components/orderDateLabels';
import { useCancelOrder } from '@/features/orders/hooks/useCancelOrder';
import { useChangePickupTime } from '@/features/orders/hooks/useChangePickupTime';
import { useOrders } from '@/features/orders/hooks/useOrders';
import { usePayNow } from '@/features/orders/hooks/usePayNow';
import type { OrderNotice } from '@/features/orders/orderNotice';
import { getDisabledDates, getRestaurantConfig, type OrderV2 } from '@/features/orders/services/ordersApi';
import { useWallet } from '@/features/credits/hooks/useWallet';
import { resolveCallName } from '@/features/auth/lib/callName';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useIsDesktop } from '@/lib/useMediaQuery';

/**
 * Ruta `/orders/mine` — "Mis pedidos" del cliente B2C (`GET /api/v2/orders`,
 * últimos 30, retiro más próximo primero, incluye cancelados). Cada acción
 * (cancelar, cambiar horario, pagar ahora) solo se ofrece cuando el backend la
 * habilita (`cancellable`, `pickupTimeChangeable`) — nunca se recalcula esa
 * ventana en el cliente. Cancelar refresca la lista y la billetera
 * (`creditsWallet`).
 *
 * F10/F17: los pedidos se agrupan en "próximos" (por defecto: PENDIENTE con
 * retiro >= ahora; CONFIRMADO y PENDIENTE_PAGO de hoy en adelante, en la zona
 * del restaurante) y "Anteriores" (pasados y cancelados, incluso futuros), que
 * quedan detrás de "Ver pedidos anteriores". "ahora" se calcula una vez por
 * carga de datos, no en cada render, para que la lista no salte de grupo sola.
 *
 * F29 (prototipos `MyOrders` y `DesktopMyOrders`, tablero v26): los próximos se
 * ordenan por semana (esta y la próxima) y por día de retiro en hora de Buenos
 * Aires (`buildOrderWeeks`). Los días abiertos salen del horario del local
 * (`pickupSchedule`) menos las fechas deshabilitadas. En móvil un interruptor
 * elige la semana; desde `lg` las dos semanas van apiladas, con cada día en una
 * fila, junto al panel lateral de F22b.
 *
 * Cada pedido es UNA fila de acordeón (`OrderAccordionItem`): cerrada resume el
 * pedido y abierta es la comanda con las acciones de su estado (antes, tarjeta +
 * comanda a pantalla completa o modal). Se guarda un solo id abierto en toda la
 * página. `?pedido=<id>` (aviso de pago pendiente, D6) abre esa fila, cambia a
 * su semana o abre "Anteriores", y la lleva a la vista; el parámetro se consume
 * recién con datos frescos (F27.1). Tras cambiar el horario el aviso queda en
 * la fila abierta; tras cancelar la fila se cierra (el pedido pasa a
 * "Anteriores") y el aviso va arriba.
 */
export function MyOrdersPage() {
  const { data: orders, isLoading, isError, isFetching } = useOrders();
  const now = useMemo(() => new Date(), [orders]);
  const [showPast, setShowPast] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // Móvil: la semana que el cliente eligió; sin elegir, esta semana.
  const [weekChoice, setWeekChoice] = useState<WeekKey | null>(null);
  const [rowNotice, setRowNotice] = useState<{ orderId: number; notice: OrderNotice } | null>(null);
  const [topNotice, setTopNotice] = useState<OrderNotice | null>(null);
  const [scroll, setScroll] = useState<{ id: number; mode: 'deep' | 'keep' } | null>(null);
  const { cancelTarget, cancelError, cancelling, requestCancel, closeSheet, confirmCancel } = useCancelOrder({
    onNotice: (notice, order) => {
      // El pedido cancelado sale de su día (pasa a "Anteriores"): la fila se cierra y el aviso va arriba.
      setOpenId((current) => (current === order.id ? null : current));
      setRowNotice(null);
      setTopNotice(notice);
    },
  });
  const { changeTarget, changeError, changing, requestChange, closeChangeSheet, confirmChange } = useChangePickupTime({
    onNotice: (notice, order) => {
      setRowNotice({ orderId: order.id, notice });
      setTopNotice(null);
    },
  });
  const { payingOrderId, payNow } = usePayNow();
  const isDesktop = useIsDesktop();
  // El saldo ("Te quedan N") solo se pide mientras hay una fila abierta; en
  // escritorio el panel lateral lo muestra siempre.
  const { data: wallet } = useWallet({ enabled: openId !== null || isDesktop });
  const sheetPresentation = isDesktop ? 'dialog' : 'sheet';
  const user = useAuthStore((s) => s.user);
  const callName = user ? resolveCallName(user) : '';
  /**
   * La config pública del local (la misma que usa `B2cOrderPage`): trae
   * `pickupLeadMinutes` para el aviso de corte de "Pago pendiente" (F18) y
   * `pickupSchedule` para los días abiertos (F29). Tolerante a que no cargue:
   * sin horario se asume lunes a viernes.
   */
  const { data: restaurantConfig } = useQuery({
    queryKey: ['restaurantConfig'],
    queryFn: getRestaurantConfig,
  });
  // F29: las fechas en que el local no abre (misma clave de caché que `B2cOrderPage`).
  const { data: disabledDatesData } = useQuery({
    queryKey: ['disabledDates'],
    queryFn: () => getDisabledDates(),
  });
  const disabledDates = useMemo(() => new Set(disabledDatesData?.map((d) => d.fecha) ?? []), [disabledDatesData]);

  const { upcoming, past } = useMemo(() => {
    const isDefaultUpcoming = (order: OrderV2): boolean => {
      if (order.estado === 'PENDIENTE') return new Date(order.pickupAt).getTime() >= now.getTime();
      if (order.estado === 'CONFIRMADO' || order.estado === 'PENDIENTE_PAGO') {
        return isRestaurantDayOnOrAfter(order.pickupAt, now);
      }
      return false;
    };
    const byPickup = (a: OrderV2, b: OrderV2) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime();
    const all = orders ?? [];
    return {
      upcoming: all.filter(isDefaultUpcoming).sort(byPickup),
      past: all.filter((order) => !isDefaultUpcoming(order)).sort((a, b) => byPickup(b, a)),
    };
  }, [orders, now]);

  const weeks = useMemo(
    () => buildOrderWeeks({ upcoming, past, now, schedule: restaurantConfig?.pickupSchedule, disabledDates }),
    [upcoming, past, now, restaurantConfig?.pickupSchedule, disabledDates],
  );

  // D6: `?pedido=<id>` ("Ver pedido" del aviso de pago pendiente) abre esa fila apenas cargan los pedidos.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedOrderParam = searchParams.get('pedido');
  useEffect(() => {
    // Con datos viejos de la caché el pedido puede faltar: se espera a que termine el refetch antes de consumir el parámetro.
    if (linkedOrderParam === null || !orders || isFetching) return;
    const linked = linkedOrderParam !== '' ? orders.find((o) => o.id === Number(linkedOrderParam)) : undefined;
    // Un id desconocido o mal formado se ignora; en ambos casos se limpia el parámetro para no reabrirla.
    if (linked) {
      setOpenId(linked.id);
      if (upcoming.some((o) => o.id === linked.id)) setWeekChoice(weekKeyOfOrder(linked, now));
      else setShowPast(true);
      setScroll({ id: linked.id, mode: 'deep' });
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('pedido');
        return next;
      },
      { replace: true },
    );
  }, [linkedOrderParam, orders, isFetching, upcoming, now, setSearchParams]);

  if (isLoading) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-12">
        <p className="text-center text-destructive text-sm">No pudimos cargar tus pedidos.</p>
      </div>
    );
  }

  const hasOrders = !!orders && orders.length > 0;
  const hasPast = past.length > 0;
  const selectedWeek = weeks.find((w) => w.key === (weekChoice ?? 'esta')) ?? weeks[0];

  const toggle = (orderId: number) => {
    setOpenId((current) => (current === orderId ? null : orderId));
    setRowNotice(null);
    setTopNotice(null);
    setScroll({ id: orderId, mode: 'keep' });
  };

  const renderOrder = (order: OrderV2, showDate = false) => (
    <OrderAccordionItem
      key={order.id}
      order={order}
      now={now}
      callName={callName}
      walletAvailable={wallet?.available ?? null}
      pickupLeadMinutes={restaurantConfig?.pickupLeadMinutes}
      open={openId === order.id}
      onToggle={() => toggle(order.id)}
      showDate={showDate}
      layout={isDesktop ? 'split' : 'stack'}
      payingNow={payingOrderId === order.id}
      notice={rowNotice?.orderId === order.id ? rowNotice.notice : null}
      onDismissNotice={() => setRowNotice(null)}
      onRequestChangePickupTime={requestChange}
      onRequestCancel={requestCancel}
      onRequestPayNow={(o) => payNow(o.id)}
      scrollMode={scroll?.id === order.id ? scroll.mode : null}
      onScrolled={() => setScroll(null)}
    />
  );

  return (
    <div className="container max-w-2xl py-8 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10 lg:py-12">
      <div className="min-w-0 space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Mis pedidos</h1>

        {topNotice && <OrderNoticeBanner notice={topNotice} onDismiss={() => setTopNotice(null)} />}

        {!hasOrders ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Todavía no hiciste ningún pedido</p>
            <Link
              to="/orders/today"
              className="mx-auto flex h-11 w-fit items-center rounded-md bg-primary-deep px-5 text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
            >
              Hacer mi primer pedido
            </Link>
          </div>
        ) : (
          <>
            {isDesktop ? (
              <div className="space-y-8">
                {weeks.map((week) => (
                  <WeekView
                    key={week.key}
                    week={week}
                    variant="desktop"
                    showPast={showPast}
                    onShowPast={() => setShowPast(true)}
                    renderOrder={(order) => renderOrder(order)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <WeekSwitch weeks={weeks} selected={selectedWeek.key} onSelect={setWeekChoice} />
                <WeekView
                  week={selectedWeek}
                  variant="mobile"
                  showPast={showPast}
                  onShowPast={() => setShowPast(true)}
                  renderOrder={(order) => renderOrder(order)}
                />
              </div>
            )}

            {hasPast && (
              <div className="flex justify-center">
                <button
                  type="button"
                  aria-expanded={showPast}
                  onClick={() => setShowPast((current) => !current)}
                  className="h-11 px-2 text-xs font-bold uppercase tracking-brand text-primary-deep"
                >
                  {showPast ? 'Ocultar pedidos anteriores' : 'Ver pedidos anteriores'}
                </button>
              </div>
            )}

            {showPast && hasPast && (
              <section className="space-y-3">
                <header className="flex items-baseline justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                    Anteriores
                  </h2>
                  <span className="text-xs font-bold text-muted-foreground">{past.length}</span>
                </header>
                <ul aria-label="Anteriores" className="m-0 flex list-none flex-col gap-3 p-0">
                  {past.map((order) => renderOrder(order, true))}
                </ul>
              </section>
            )}

            <p className="text-center text-xs text-muted-foreground">Mostramos tus últimos 30 pedidos.</p>
          </>
        )}
      </div>

      {isDesktop && (
        <MyOrdersSidePanel
          available={wallet?.available ?? null}
          committed={wallet?.committed ?? null}
          pickupLeadMinutes={restaurantConfig?.pickupLeadMinutes}
        />
      )}

      <CancelOrderSheet
        order={cancelTarget}
        now={now}
        cancelling={cancelling}
        errorMessage={cancelError}
        onConfirm={confirmCancel}
        onClose={closeSheet}
        presentation={sheetPresentation}
      />

      <ChangePickupTimeSheet
        order={changeTarget}
        changing={changing}
        errorMessage={changeError}
        onConfirm={confirmChange}
        onClose={closeChangeSheet}
        presentation={sheetPresentation}
      />
    </div>
  );
}
