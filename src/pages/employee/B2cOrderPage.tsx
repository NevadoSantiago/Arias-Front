import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, UtensilsCrossed } from 'lucide-react';
import { DishCard } from '@/features/orders/components/DishCard';
import { FilterPills } from '@/features/orders/components/FilterPills';
import type { ActiveFilter } from '@/features/orders/components/FilterPills';
import { WeekDaySelector } from '@/features/orders/components/WeekDaySelector';
import { CartBar } from '@/features/orders/components/b2c/CartBar';
import { DishSheet } from '@/features/orders/components/b2c/DishSheet';
import { EmptyBalanceCard } from '@/features/orders/components/b2c/EmptyBalanceCard';
import { OrderConfirmedView } from '@/features/orders/components/b2c/OrderConfirmedView';
import type { ConfirmedItem } from '@/features/orders/components/b2c/OrderConfirmedView';
import { OrderReviewSheet } from '@/features/orders/components/b2c/OrderReviewSheet';
import { useCart } from '@/features/orders/hooks/useCart';
import {
  getAvailableDishes,
  getDisabledDates,
  getMenuSections,
  getOrdersV2,
  getRestaurantConfig,
  InsufficientCreditsError,
  placeOrderV2,
} from '@/features/orders/services/ordersApi';
import type { Dish } from '@/features/orders/types';
import { useWallet } from '@/features/credits/hooks/useWallet';
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

interface DoneData {
  isToday: boolean;
  dayLongLabel: string;
  pickupTimeLabel: string;
  items: ConfirmedItem[];
  totalLunches: number;
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
 * en vez de un toast efímero.
 */
export function B2cOrderPage() {
  const user = useAuthStore((s) => s.user);
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

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const cart = useCart();

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

  const isToday = selectedDate === todayStr;
  const dayShortLabel = formatDayLabel(selectedDate).toLowerCase();

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
  const confirmLabel = pickupTimeLabel
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
    // Snapshot ANTES de limpiar el carrito — el ticket de confirmación sigue
    // mostrando los ítems y el total del pedido que se acaba de confirmar.
    const itemsSnapshot: ConfirmedItem[] = cart.lines.map((line) => ({
      name: line.dish.nombre,
      side: line.sideNombre ? `con ${line.sideNombre.toLowerCase()}` : null,
      costLabel: `${line.dish.category.creditCost} ${line.dish.category.creditCost === 1 ? 'almuerzo' : 'almuerzos'}`,
    }));
    const totalSnapshot = cart.totalCredits;
    try {
      await placeOrderV2({
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
      setReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      setDone({
        isToday,
        dayLongLabel: formatDayLongLabel(selectedDate),
        pickupTimeLabel: pickupTimeLabel!,
        items: itemsSnapshot,
        totalLunches: totalSnapshot,
        walletAvailableAfter: wallet ? wallet.available - totalSnapshot : null,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        setInsufficientBalance(true);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Ocurrió un error al confirmar el pedido.');
      }
    } finally {
      setSubmitting(false);
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
      <div className="container max-w-xl py-8 lg:py-12">
        <OrderConfirmedView
          isToday={done.isToday}
          dayLongLabel={done.dayLongLabel}
          pickupTimeLabel={done.pickupTimeLabel}
          items={done.items}
          totalLunches={done.totalLunches}
          walletAvailableAfter={done.walletAvailableAfter}
          onBackToMenu={() => setDone(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="container flex-1 py-8 lg:py-12">
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
            onSelect={setSelectedDate}
            orderedDates={orderedDates}
            disabledDates={disabledDates}
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

            {config?.pickupWindowStart && config.pickupWindowEnd && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-primary-deep" aria-hidden="true" />
                <span>
                  <span className="sr-only">Horario de retiro: </span>
                  {config.pickupWindowStart} – {config.pickupWindowEnd}
                </span>
              </span>
            )}
          </div>
        </div>

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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
                  {sectionDishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} onSelect={setSelectedDish} hideStock={!isToday} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

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

      <DishSheet dish={selectedDish} open={!!selectedDish} onClose={() => setSelectedDish(null)} onConfirm={handleAddToCart} />

      <OrderReviewSheet
        open={reviewOpen && cart.lines.length > 0}
        onClose={() => setReviewOpen(false)}
        isToday={isToday}
        dayShortLabel={dayShortLabel}
        fecha={selectedDate}
        lastUsedTimeOfDay={lastUsedTimeOfDay}
        onSelectPickup={(time) => setPickupSelection({ date: selectedDate, time })}
        lines={cart.lines}
        totalLunches={cart.totalCredits}
        onRemoveLine={handleRemoveLine}
        walletAvailable={wallet?.available ?? null}
        confirmLabel={confirmLabel}
        canConfirm={canConfirm}
        submitting={submitting}
        submitError={submitError}
        insufficientBalance={insufficientBalance}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
