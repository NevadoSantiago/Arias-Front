import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DishCard } from '@/features/orders/components/DishCard';
import { DishDetailDialog } from '@/features/orders/components/DishDetailDialog';
import { FilterPills } from '@/features/orders/components/FilterPills';
import type { ActiveFilter } from '@/features/orders/components/FilterPills';
import { OrderConfirmation } from '@/features/orders/components/OrderConfirmation';
import { WeekDaySelector } from '@/features/orders/components/WeekDaySelector';
import { PickupTimePicker } from '@/features/orders/components/b2c/PickupTimePicker';
import { CartSummary } from '@/features/orders/components/CartSummary';
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

/**
 * Pantalla de pedido para clientes B2C (sin empresa) — carrito multi-ítem,
 * horario de retiro y confirmación contra `POST /api/v2/orders`. `TodayOrderPage`
 * decide si renderiza esta pantalla o `CompanyOrderPage` según `user.companyId`.
 *
 * Costo en "almuerzos" — NUNCA "créditos" (proposal `b2c-credits-pivot`,
 * "Vocabulario") — y NUNCA calculado en el cliente: el total del carrito sale
 * de `dish.category.creditCost` (reportado por el backend), y el rechazo por
 * saldo insuficiente siempre lo decide el backend (`InsufficientCreditsError`).
 */
export function B2cOrderPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
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
  const [confirmation, setConfirmation] = useState<string | null>(null);

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

  const handleAddToCart = async (selection: { sideId: number | null; notas: string | null }) => {
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

  const handleConfirm = async () => {
    if (!pickupAt) return;
    setSubmitError(null);
    setInsufficientBalance(false);
    setSubmitting(true);
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
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      setConfirmation('¡Pedido confirmado!');
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

  return (
    <div className="container py-8 lg:py-12">
      <header className="mb-6 lg:mb-8">
        <h1 className="font-display text-foreground text-3xl lg:text-5xl font-bold leading-tight mb-1 lg:mb-2">
          {isToday ? `¡Buen día, ${user.firstName}!` : `Planificá tu comida del ${formatDayLabel(selectedDate)}`}
        </h1>
        <p className="text-muted-foreground text-sm lg:text-base">
          {isToday ? '¿Qué querés comer hoy?' : '¿Qué querés comer?'}
        </p>
      </header>

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

          {config && (
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
                  <DishCard key={dish.id} dish={dish} onSelect={setSelectedDish} />
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
                  <DishCard key={dish.id} dish={dish} onSelect={setSelectedDish} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <DishDetailDialog
        dish={selectedDish}
        open={!!selectedDish}
        onClose={() => setSelectedDish(null)}
        confirmLabel="Agregar al carrito"
        onConfirm={handleAddToCart}
      />

      {/* ── Carrito + horario de retiro ──────────────────────────────────── */}
      <section className="mt-10 lg:mt-14 max-w-xl mx-auto space-y-4 border-t border-border pt-8">
        <h2 className="font-display text-foreground text-xl lg:text-2xl font-bold">
          Tu pedido
        </h2>

        <CartSummary
          lines={cart.lines}
          totalCredits={cart.totalCredits}
          onRemove={cart.removeItem}
          insufficientBalance={insufficientBalance}
        />

        {cart.lines.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm uppercase tracking-brand font-medium text-muted-foreground">
              Horario de retiro
            </h3>
            <PickupTimePicker
              fecha={selectedDate}
              isToday={isToday}
              dayShortLabel={dayShortLabel}
              lastUsedTimeOfDay={lastUsedTimeOfDay}
              onSelect={(time) => setPickupSelection({ date: selectedDate, time })}
            />
          </div>
        )}

        {submitError && (
          <p role="alert" className="text-destructive text-xs">
            {submitError}
          </p>
        )}

        <Button
          type="button"
          disabled={!canConfirm}
          onClick={handleConfirm}
          className="w-full uppercase tracking-brand font-medium"
        >
          {submitting ? 'Confirmando…' : confirmLabel}
        </Button>
      </section>

      {confirmation && (
        <OrderConfirmation
          message={confirmation}
          duration={2500}
          onComplete={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}
