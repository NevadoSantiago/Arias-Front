import { useLayoutEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'] as const;
const WEEKEND_LABELS: Record<number, string> = { 0: 'Dom', 6: 'Sáb' };

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  orderedDates: Set<string>;
  disabledDates?: Set<string>;
  /**
   * B2C only (F13): cuando hoy es sábado o domingo, antepone un chip de hoy
   * antes del lunes a viernes de la semana próxima (la semana ya pasada —
   * lunes a viernes anteriores a hoy — se omite: no aporta nada pedible). El
   * backend ya admite pedir cualquier día de la semana actual y la próxima
   * (`PickupSlotService.isWithinSchedulableWeeks`, lunes-domingo); esto solo
   * expone el fin de semana en el selector. Default `false`: `CompanyOrderPage`
   * (B2B) no lo pasa y su salida queda idéntica (ver test de caracterización).
   */
  includeWeekendToday?: boolean;
  /**
   * B2C en escritorio (F22a): la columna del menú es más angosta que la
   * pantalla (el panel "Tu pedido" ocupa el resto), así que las fichas de
   * `lg:` bajan a 64px y la tira scrollea si aún no entra, en vez de
   * desbordar hacia el panel. Default `false`: `CompanyOrderPage` (B2B) no lo
   * pasa y su salida queda idéntica.
   */
  fitColumn?: boolean;
}

function getWeekdays(mondayDate: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getMondayOf(date: string): Date {
  const d = new Date(date + 'T12:00:00');
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return monday;
}

export function WeekDaySelector({
  selectedDate,
  onSelect,
  orderedDates,
  disabledDates,
  includeWeekendToday = false,
  fitColumn = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const week1Ref = useRef<HTMLDivElement>(null);
  const week2Ref = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const currentMonday = useMemo(() => getMondayOf(today), [today]);
  const nextMonday = useMemo(() => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + 7);
    return d;
  }, [currentMonday]);

  const currentWeek = useMemo(() => getWeekdays(currentMonday), [currentMonday]);
  const nextWeek = useMemo(() => getWeekdays(nextMonday), [nextMonday]);

  /**
   * `today` ya es el string de fecha LOCAL (misma construcción de arriba,
   * sin `toISOString`); el chip de hoy en fin de semana lo reusa tal cual
   * para no reintroducir el corrimiento de huso horario que sí tendría
   * `new Date().toISOString()` después de las 21:00 en Argentina (UTC-3).
   */
  const todayWeekendLabel = WEEKEND_LABELS[new Date(today + 'T12:00:00').getDay()] as string | undefined;
  const showWeekendToday = includeWeekendToday && todayWeekendLabel !== undefined;

  const nextWeekStart = nextWeek[0];
  const isInWeek2 = selectedDate >= nextWeekStart;

  useLayoutEffect(() => {
    const target = isInWeek2 ? week2Ref.current : week1Ref.current;
    const container = scrollRef.current;
    if (target && container && container.clientWidth < container.scrollWidth) {
      container.scrollLeft = target.offsetLeft;
    }
  }, [isInWeek2]);

  const renderDay = (date: string, label: string) => {
    const dayNum = new Date(date + 'T12:00:00').getDate();
    const isPast = date < today;
    const isToday = date === today;
    const isSelected = date === selectedDate;
    const hasOrder = orderedDates.has(date);
    const isClosed = disabledDates?.has(date) ?? false;
    const isDisabled = isPast || isClosed;

    return (
      <button
        key={date}
        type="button"
        disabled={isDisabled}
        onClick={() => onSelect(date)}
        className={cn(
          'relative flex flex-col items-center justify-center w-12 h-14 rounded-lg text-xs transition-all shrink-0',
          fitColumn ? 'lg:w-16 lg:h-16' : 'lg:w-20 lg:h-16',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isSelected
            ? 'bg-primary text-primary-foreground shadow-md'
            : isDisabled
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : 'bg-card border border-border text-foreground hover:border-primary hover:text-primary cursor-pointer',
          isToday && !isSelected && !isClosed && 'border-primary/50',
          isClosed && !isPast && 'line-through decoration-muted-foreground/40'
        )}
      >
        <span className="uppercase tracking-brand font-medium text-[10px] sm:text-[11px] leading-none">
          {label}
        </span>
        <span className={cn(
          'font-semibold text-sm sm:text-base leading-none mt-0.5',
          isToday && !isSelected && !isClosed && 'text-primary'
        )}>
          {dayNum}
        </span>
        {hasOrder && !isClosed && !isPast && (
          <Check className={cn(
            'absolute -top-1 -right-1 w-4 h-4 p-0.5 rounded-full',
            isSelected
              ? 'bg-primary-foreground text-primary'
              : 'bg-green-500 text-white'
          )} strokeWidth={3} />
        )}
      </button>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex overflow-x-auto snap-x snap-mandatory',
        fitColumn ? 'lg:snap-none' : 'lg:overflow-visible lg:snap-none lg:justify-center',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      )}
    >
      {showWeekendToday ? (
        <div ref={week1Ref} className="flex gap-1.5 sm:gap-2 px-4 lg:px-0 shrink-0 snap-start w-full justify-center lg:w-auto">
          {renderDay(today, todayWeekendLabel!)}
          {nextWeek.map((d, i) => renderDay(d, DAY_LABELS[i]))}
        </div>
      ) : (
        <>
          <div ref={week1Ref} className="flex gap-1.5 sm:gap-2 px-4 lg:px-0 shrink-0 snap-start w-full justify-center lg:w-auto">
            {currentWeek.map((d, i) => renderDay(d, DAY_LABELS[i]))}
          </div>
          <div className="hidden lg:flex items-center px-3" aria-hidden="true">
            <div className="w-px h-10 bg-border" />
          </div>
          <div ref={week2Ref} className="flex gap-1.5 sm:gap-2 px-4 lg:px-0 shrink-0 snap-start w-full justify-center lg:w-auto">
            {nextWeek.map((d, i) => renderDay(d, DAY_LABELS[i]))}
          </div>
        </>
      )}
    </div>
  );
}
