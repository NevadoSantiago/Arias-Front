import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DishCard } from '@/features/orders/components/DishCard';
import { DishDetailDialog } from '@/features/orders/components/DishDetailDialog';
import { FilterPills } from '@/features/orders/components/FilterPills';
import type { ActiveFilter } from '@/features/orders/components/FilterPills';
import { getDisabledDates, getMenuSections } from '@/features/orders/services/ordersApi';
import { getDishCalendar, getRestaurantConfigAdmin, listDishesAdmin } from '@/features/admin/services/adminApi';
import { buildPickupHours, schedulableRange } from '@/features/admin/menu/pickupHours';
import { TodayPickupCard, WeekPickupStrip } from '@/features/admin/menu/PickupHoursPanel';
import type { Dish } from '@/features/orders/types';

/** How often the "next available slot" is recomputed against the clock. */
const CLOCK_TICK_MS = 30_000;

export function AdminMenuPreviewPage() {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const isScrolling = useRef(false);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // The admin endpoint is the same URL as the public one but carries pickupSlotMinutes and the timezone.
  const { data: config } = useQuery({ queryKey: ['restaurantConfigAdmin'], queryFn: getRestaurantConfigAdmin });
  // Plain strings: the query key only changes when the week does, not on every clock tick.
  const range = config ? schedulableRange(now, config.timezone) : null;
  const { data: disabledDates, isLoading: disabledLoading } = useQuery({
    queryKey: ['disabledDates', range?.from, range?.to],
    queryFn: () => getDisabledDates(range!.from, range!.to),
    enabled: !!range,
  });
  const { data: sections } = useQuery({ queryKey: ['menuSections'], queryFn: getMenuSections });
  const { data: adminDishes, isLoading } = useQuery({ queryKey: ['adminDishes'], queryFn: listDishesAdmin });
  const { data: calendar } = useQuery({
    queryKey: ['dishCalendar', today],
    queryFn: () => getDishCalendar(today, today),
  });

  const todaySpecialIds = useMemo(() => new Set(calendar?.[today] ?? []), [calendar, today]);

  const dishes: Dish[] = useMemo(() => {
    if (!adminDishes) return [];
    return adminDishes
      .filter((d) => d.enabled)
      .map((d) => ({
        id: d.id,
        nombre: d.nombre,
        descripcion: d.descripcion ?? '',
        fotoUrl: d.fotoUrl,
        category: d.category,
        menuSection: d.menuSection,
        sideType: d.sideType,
        allowedSides: d.allowedSides.map((s) => ({ ...s, enabled: true })),
        stockActual: d.stockActual,
        especial: d.especial,
      }));
  }, [adminDishes]);

  const specialDishes = useMemo(
    () => dishes.filter((d) => d.especial && todaySpecialIds.has(d.id)),
    [dishes, todaySpecialIds]
  );
  const regularDishes = useMemo(() => dishes.filter((d) => !d.especial), [dishes]);

  const counts = useMemo(() => {
    const map: Record<number | 'all', number> = { all: regularDishes.length };
    sections?.forEach((s) => {
      map[s.id] = regularDishes.filter((d) => d.menuSection.id === s.id).length;
    });
    return map;
  }, [regularDishes, sections]);

  const groupedBySection = useMemo(() => {
    if (!sections) return [];
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

  if (isLoading || disabledLoading || !config || !sections) {
    return (
      <div className="p-6 lg:p-10">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  const pickupHours = buildPickupHours({
    now,
    timezone: config.timezone,
    leadMinutes: config.pickupLeadMinutes,
    slotMinutes: config.pickupSlotMinutes,
    schedule: config.pickupSchedule ?? [],
    disabledDates: disabledDates ?? [],
  });

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 lg:gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Vista previa del menú
          </h1>
          <p className="text-muted-foreground text-sm">
            Así ven los empleados el menú de hoy. Solo lectura.
          </p>
        </div>
        <TodayPickupCard
          hours={pickupHours}
          now={now}
          timezone={config.timezone}
          slotMinutes={config.pickupSlotMinutes}
        />
      </header>

      <div className="mb-8">
        <WeekPickupStrip
          hours={pickupHours}
          slotMinutes={config.pickupSlotMinutes}
          leadMinutes={config.pickupLeadMinutes}
        />
      </div>

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
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    onSelect={setSelectedDish}
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
        readonly
      />
    </div>
  );
}
