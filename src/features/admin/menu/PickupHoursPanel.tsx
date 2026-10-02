import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinute, minuteOfDay } from '@/features/admin/kitchen/kitchenBoard';
import type { PickupHours, TodayPickup, WeekDay } from './pickupHours';

function todayLabel(now: Date, timezone: string): string {
  const weekday = new Intl.DateTimeFormat('es-AR', { timeZone: timezone, weekday: 'long' }).format(now);
  return `${weekday}, ${formatMinute(minuteOfDay(now, timezone))}`;
}

function TodayBody({ today, slotMinutes }: { today: TodayPickup; slotMinutes: number }) {
  if (today.kind === 'closed' || today.kind === 'disabled') {
    return (
      <>
        <p className="text-lg font-bold">Hoy no se retiran pedidos</p>
        {today.kind === 'disabled' && today.motivo && (
          <p className="text-sm text-muted-foreground">{today.motivo}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {today.nextOpen ? `Próximo día con retiro: ${today.nextOpen}.` : 'No hay otro día con retiro en las próximas dos semanas.'}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-2xl font-bold leading-tight">{today.range}</p>
      <p className="text-sm text-muted-foreground">
        Horarios cada {slotMinutes} min · último horario {today.last}
      </p>
      {today.kind === 'ended' && (
        <p className="text-sm font-semibold text-destructive">
          Hoy ya no quedan horarios.
          {today.nextOpen ? ` Próximo: ${today.nextOpen}.` : ''}
        </p>
      )}
    </>
  );
}

export function TodayPickupCard({
  hours,
  now,
  timezone,
  slotMinutes,
}: {
  hours: PickupHours;
  now: Date;
  timezone: string;
  slotMinutes: number;
}) {
  return (
    <section
      aria-labelledby="pickup-today-title"
      className="min-w-[320px] flex flex-col gap-2 px-5 py-4 border border-border rounded-md bg-card"
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
        <h2
          id="pickup-today-title"
          className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground"
        >
          Retiro en el local · hoy {todayLabel(now, timezone)}
        </h2>
      </div>
      <TodayBody today={hours.today} slotMinutes={slotMinutes} />
    </section>
  );
}

function dayNote(day: WeekDay): string {
  if (day.kind === 'open') return `último ${day.last}`;
  return day.kind === 'disabled' ? (day.motivo ?? 'fecha deshabilitada') : 'sin retiro';
}

export function WeekPickupStrip({
  hours,
  slotMinutes,
  leadMinutes,
}: {
  hours: PickupHours;
  slotMinutes: number;
  leadMinutes: number;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 id="pickup-week-title" className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
        Horarios de retiro de la semana
      </h2>
      <ul
        aria-labelledby="pickup-week-title"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2"
      >
        {hours.week.map((day) => (
          <li
            key={day.name}
            aria-current={day.isToday ? 'date' : undefined}
            className={cn(
              'flex flex-col gap-0.5 px-3 py-2.5 rounded-md border',
              day.isToday && 'bg-primary text-primary-foreground border-primary',
              !day.isToday && day.kind === 'open' && 'bg-card border-border',
              !day.isToday && day.kind !== 'open' && 'border-dashed border-border text-muted-foreground',
            )}
          >
            <span className="text-[11px] font-semibold uppercase tracking-brand">
              {day.name}
              {day.isToday ? ' · hoy' : ''}
            </span>
            <span className="text-[15px] font-semibold">{day.kind === 'open' ? day.range : 'Cerrado'}</span>
            <span className="text-xs opacity-85">{dayNote(day)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Se ofrece cada {slotMinutes} min desde la apertura; el primer horario disponible es {leadMinutes} min después
        de la hora actual y el último, el anterior al cierre. Se configura en Configuración › Horarios de retiro.
      </p>
    </section>
  );
}

