import { useLayoutEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'] as const;

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  orderedDates: Set<string>;
  disabledDates?: Set<string>;
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

export function WeekDaySelector({ selectedDate, onSelect, orderedDates, disabledDates }: Props) {
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

  const nextWeekStart = nextWeek[0];
  const isInWeek2 = selectedDate >= nextWeekStart;

  useLayoutEffect(() => {
    const target = isInWeek2 ? week2Ref.current : week1Ref.current;
    const container = scrollRef.current;
    if (target && container && container.clientWidth < container.scrollWidth) {
      container.scrollLeft = target.offsetLeft;
    }
  }, [isInWeek2]);

  const renderDay = (date: string, i: number) => {
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
          'relative flex flex-col items-center justify-center w-12 h-14 lg:w-20 lg:h-16 rounded-lg text-xs transition-all shrink-0',
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
          {DAY_LABELS[i]}
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
        'lg:overflow-visible lg:snap-none lg:justify-center',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      )}
    >
      <div ref={week1Ref} className="flex gap-1.5 sm:gap-2 px-4 lg:px-0 shrink-0 snap-start w-full justify-center lg:w-auto">
        {currentWeek.map((d, i) => renderDay(d, i))}
      </div>
      <div className="hidden lg:flex items-center px-3" aria-hidden="true">
        <div className="w-px h-10 bg-border" />
      </div>
      <div ref={week2Ref} className="flex gap-1.5 sm:gap-2 px-4 lg:px-0 shrink-0 snap-start w-full justify-center lg:w-auto">
        {nextWeek.map((d, i) => renderDay(d, i))}
      </div>
    </div>
  );
}
