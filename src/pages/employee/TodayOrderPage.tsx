import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock } from 'lucide-react';
import { DishCard } from '@/features/orders/components/DishCard';
import { DishDetailDialog } from '@/features/orders/components/DishDetailDialog';
import { FilterPills } from '@/features/orders/components/FilterPills';
import { OrderConfirmation } from '@/features/orders/components/OrderConfirmation';
import { WeekDaySelector } from '@/features/orders/components/WeekDaySelector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import panaderoDuda from '@/assets/illustrations/Panadero-Duda.svg';
import type { ActiveFilter } from '@/features/orders/components/FilterPills';
import {
  cancelOrder,
  getAvailableDishes,
  getDisabledDates,
  getMenuSections,
  getRestaurantConfig,
  getWeekOrders,
  placeOrder,
  updateOrder,
} from '@/features/orders/services/ordersApi';
import type { Dish } from '@/features/orders/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import { orderFlowPaths } from '@/features/orders/orderFlowPaths';
import { detectOrderIssues } from '@/features/orders/orderIssues';
import { cn } from '@/lib/utils';

function calculateRemaining(cutoffTime: string): string {
  const [h, m] = cutoffTime.split(':').map(Number);
  const cutoff = new Date();
  cutoff.setHours(h, m, 0, 0);
  const diff = cutoff.getTime() - Date.now();
  if (diff <= 0) return 'Cerrado';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const formatted = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function TodayOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const isScrolling = useRef(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;
  const isPast = selectedDate < todayStr;

  const user = useAuthStore((s) => s.user);
  const paths = orderFlowPaths(user?.role);
  const { data: config } = useQuery({ queryKey: ['restaurantConfig'], queryFn: getRestaurantConfig });
  const { data: sections } = useQuery({ queryKey: ['menuSections'], queryFn: getMenuSections });

  const { data: weekOrders } = useQuery({
    queryKey: ['weekOrders'],
    queryFn: getWeekOrders,
  });

  const { data: disabledDatesData } = useQuery({
    queryKey: ['disabledDates'],
    queryFn: () => getDisabledDates(),
  });

  const disabledDates = useMemo(() => {
    return new Set(disabledDatesData?.map((d) => d.fecha) ?? []);
  }, [disabledDatesData]);

  const orderedDates = useMemo(() => {
    return new Set(weekOrders?.map((o) => o.fecha) ?? []);
  }, [weekOrders]);

  const orderForSelectedDate = useMemo(() => {
    return weekOrders?.find((o) => o.fecha === selectedDate) ?? null;
  }, [weekOrders, selectedDate]);

  const { data: dishes, isLoading: loadingDishes } = useQuery({
    queryKey: ['availableDishes', selectedDate],
    queryFn: () => getAvailableDishes(isToday ? undefined : selectedDate),
  });

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

  const handlePillChange = useCallback((filter: ActiveFilter) => {
    isScrolling.current = true;
    setActiveFilter(filter);
    setTimeout(() => { isScrolling.current = false; }, 1000);
  }, []);

  useEffect(() => {
    if (!groupedBySection.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = Number(entry.target.id.replace('section-', ''));
            if (!isNaN(id)) setActiveFilter(id);
            break;
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    );

    for (const g of groupedBySection) {
      const el = document.getElementById(`section-${g.section.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [groupedBySection]);

  const placeMutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (data) => {
      if (isToday) {
        queryClient.setQueryData(['todayOrder'], data);
      }
      queryClient.invalidateQueries({ queryKey: ['weekOrders'] });
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      setSelectedDish(null);
      if (isFuture) {
        toast.success(`Pedido programado para ${formatDayLabel(selectedDate)}`);
      } else {
        setConfirmation('¡Pedido confirmado!');
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (fecha: string) => cancelOrder(fecha),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekOrders'] });
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      toast.success(`Pedido cancelado para ${formatDayLabel(selectedDate)}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: Parameters<typeof placeOrder>[0] }) =>
      updateOrder(orderId, payload),
    onSuccess: (data) => {
      if (isToday) {
        queryClient.setQueryData(['todayOrder'], data);
      }
      queryClient.invalidateQueries({ queryKey: ['weekOrders'] });
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      setSelectedDish(null);
      if (isFuture) {
        toast.success(`Pedido actualizado para ${formatDayLabel(selectedDate)}`);
      } else {
        setConfirmation('¡Pedido modificado!');
      }
    },
  });

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loadingDishes || !user || !config || !sections) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  const remaining = calculateRemaining(config.horaCorte);
  const isClosed = remaining === 'Cerrado';
  const hasOrder = orderForSelectedDate != null;
  const isReadonly = isPast || (isToday && isClosed);

  return (
    <div className="container py-8 lg:py-12">
      {/* ── Header (saludo + cierre/info) ──────────────────────────────── */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 lg:gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-5xl font-bold leading-tight mb-1 lg:mb-2">
            {isPast
              ? `Pedido del ${formatDayLabel(selectedDate)}`
              : isFuture
                ? `Planificá tu comida del ${formatDayLabel(selectedDate)}`
                : `¡Buen día, ${user.firstName}!`}
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            {isPast
              ? 'Este pedido ya no se puede modificar.'
              : isFuture
                ? (hasOrder ? 'Podés modificar o cancelar este pedido hasta el día.' : '¿Qué querés comer?')
                : '¿Qué querés comer hoy?'}
          </p>
          {/* Info de cierre — solo para hoy */}
          {isToday && (
            <p className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground lg:hidden">
              <Clock className="w-3 h-3 text-primary" />
              <span>
                Cierre <span className="text-foreground font-medium">{config.horaCorte}</span>
                <span className="mx-1.5">·</span>
                {remaining === 'Cerrado' ? 'cerrado' : `te quedan ${remaining}`}
              </span>
            </p>
          )}
          {isFuture && (
            <p className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground lg:hidden">
              <CalendarDays className="w-3 h-3 text-primary" />
              <span>Pedido tentativo</span>
            </p>
          )}
        </div>
        {isToday && (
          <div className="hidden lg:flex items-center gap-2 text-foreground text-sm">
            <Clock className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[11px] uppercase tracking-brand text-muted-foreground font-medium leading-none mb-1">
                Cierre de pedidos
              </p>
              <p className="font-medium leading-none">
                {config.horaCorte}{' '}
                <span className="text-muted-foreground font-normal">
                  ({remaining === 'Cerrado' ? 'cerrado' : `te quedan ${remaining}`})
                </span>
              </p>
            </div>
          </div>
        )}
        {isFuture && (
          <div className="hidden lg:flex items-center gap-2 text-foreground text-sm">
            <CalendarDays className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[11px] uppercase tracking-brand text-muted-foreground font-medium leading-none mb-1">
                Pedido tentativo
              </p>
              <p className="font-medium leading-none text-muted-foreground">
                Podés cambiarlo hasta el día
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── Selector de semana ──────────────────────────────────────────── */}
      <div className="mb-6">
        <WeekDaySelector
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          orderedDates={orderedDates}
          disabledDates={disabledDates}
        />
      </div>

      {/* ── Banner: ya hay pedido para la fecha seleccionada ─────────── */}
      {hasOrder && (() => {
        const isDelivered = orderForSelectedDate.estado === 'ENTREGADO';
        const issues = detectOrderIssues(orderForSelectedDate);
        const Icon = isDelivered ? CheckCircle2 : issues.hasAny ? AlertTriangle : CheckCircle2;
        const bannerLabel = isDelivered
          ? '¡Buen provecho!'
          : isToday
            ? (issues.hasAny ? 'Tu pedido necesita un cambio' : 'Ver mi pedido')
            : isPast
              ? `Pedido del ${formatDayLabel(selectedDate)}`
              : (issues.hasAny ? 'Tu pedido necesita un cambio' : 'Programado');

        const isClickable = isToday && !isDelivered;
        const Wrapper = isClickable ? 'button' : 'div';
        return (
          <div
            className={cn(
              'group w-full mb-8 flex items-center justify-between gap-4 px-5 py-4 rounded-lg border transition-colors',
              isDelivered
                ? 'border-success/50 bg-success/10'
                : issues.hasAny
                  ? 'border-warning/50 bg-warning/10'
                  : 'border-primary/30 bg-primary/5',
              isClickable && (issues.hasAny ? 'hover:bg-warning/15 hover:border-warning/70 cursor-pointer' : 'hover:bg-primary/10 hover:border-primary/50 cursor-pointer')
            )}
          >
            <Wrapper
              {...(isClickable ? { type: 'button' as const, onClick: () => navigate(paths.summary) } : {})}
              className="flex items-center gap-3 text-left flex-1 min-w-0"
            >
              <Icon className={cn(
                'w-5 h-5 shrink-0',
                isDelivered ? 'text-success' : issues.hasAny ? 'text-warning' : isPast ? 'text-muted-foreground' : 'text-primary'
              )} />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-sm font-semibold text-foreground uppercase tracking-brand flex items-start flex-wrap gap-x-1.5">
                  <span>{bannerLabel}</span>
                  {isClickable && (
                    <ArrowRight className={cn(
                      'w-3.5 h-3.5 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform',
                      issues.hasAny ? 'text-warning' : 'text-primary'
                    )} />
                  )}
                </p>
                {!isDelivered && (
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {issues.hasAny ? issues.summary : (
                      <>
                        {orderForSelectedDate.dishNombre}
                        {orderForSelectedDate.sideNombre ? ` · ${orderForSelectedDate.sideNombre.toLowerCase()}` : ''}
                      </>
                    )}
                  </p>
                )}
              </div>
            </Wrapper>
            {isFuture && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={cancelMutation.isPending}
                    className="text-xs uppercase tracking-brand font-medium text-destructive hover:text-destructive/80 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar'}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="sm:max-w-xl">
                  <div className="flex items-center gap-5 sm:gap-6">
                    <div className="flex-1 min-w-0">
                      <AlertDialogHeader className="text-left space-y-2">
                        <AlertDialogTitle className="font-display text-2xl text-left">
                          ¿Cancelar pedido?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm leading-relaxed text-left">
                          Estás cancelando el pedido del {formatDayLabel(selectedDate)}. Podés volver a programarlo cuando quieras.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-5 flex-row gap-2 sm:justify-start">
                        <AlertDialogCancel
                          disabled={cancelMutation.isPending}
                          className="uppercase tracking-brand text-xs mt-0"
                        >
                          No, dejarlo
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={cancelMutation.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            cancelMutation.mutate(selectedDate);
                          }}
                          className="uppercase tracking-brand text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {cancelMutation.isPending ? 'Cancelando…' : 'Sí, cancelar'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </div>
                    <img
                      src={panaderoDuda}
                      alt=""
                      aria-hidden="true"
                      className="hidden sm:block w-32 lg:w-36 h-auto shrink-0 select-none pointer-events-none"
                    />
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        );
      })()}

      <div className="mb-8 sticky top-0 z-20 bg-background py-2 -mt-2">
        <FilterPills
          sections={sections}
          active={activeFilter}
          counts={counts}
          onChange={handlePillChange}
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
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    onSelect={setSelectedDish}
                    readonly={isReadonly}
                    hideStock={isFuture}
                  />
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
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    onSelect={setSelectedDish}
                    readonly={isReadonly}
                    hideStock={isFuture}
                  />
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
        confirmLabel={hasOrder ? 'Modificar pedido' : 'Confirmar pedido'}
        onConfirm={async (selection) => {
          if (!selectedDish) return;
          const payload = {
            dishId: selectedDish.id,
            sideId: selection.sideId,
            notas: selection.notas,
            ...(isFuture ? { fecha: selectedDate } : {}),
          };
          if (orderForSelectedDate) {
            await updateMutation.mutateAsync({ orderId: orderForSelectedDate.id, payload });
          } else {
            await placeMutation.mutateAsync(payload);
          }
        }}
      />

      {confirmation && (
        <OrderConfirmation
          message={confirmation}
          onComplete={() => {
            setConfirmation(null);
            if (isToday) {
              navigate(paths.summary);
            }
          }}
        />
      )}
    </div>
  );
}
