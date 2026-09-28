import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPickupSlots } from '../../services/ordersApi';

interface SlotInfo {
  iso: string;
  h: number;
  m: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timeOfDay(iso: string): { h: number; m: number } {
  const d = new Date(iso);
  return { h: d.getHours(), m: d.getMinutes() };
}

function formatHM(h: number, m: number): string {
  return `${pad(h)}:${pad(m)}`;
}

interface Props {
  /** "YYYY-MM-DD" — fecha para la que se piden horarios de retiro. */
  fecha: string;
  isToday: boolean;
  /** Etiqueta corta del día ("jueves 21") usada en el readout para días futuros. */
  dayShortLabel: string;
  /** Hora local "HH:MM" del último pedido NO cancelado (mayor `id`), o null si no hay. */
  lastUsedTimeOfDay: string | null;
  /** ISO-8601 exacto del slot elegido, tal como lo devolvió `getPickupSlots`. */
  onSelect: (pickupAt: string) => void;
  /**
   * Pedido de saltar a un horario (F21, atajo "Sumarlo al pedido de las
   * HH:MM"): cada objeto nuevo es un pedido nuevo. Si el horario está entre
   * los slots del día, el selector pasa a "Elegir horario" con ese valor.
   */
  jumpTo?: { pickupAt: string } | null;
}

/**
 * Selector de horario de retiro B2C — reemplaza a `PickupSlotSelector` (que
 * sigue existiendo, sin cambios, para lo que todavía no migró). Las
 * opciones salen ÚNICAMENTE de `getPickupSlots(fecha)`: nunca se genera un
 * horario en el cliente. Preselecciona automáticamente "Última utilizada" (si
 * la hora del último pedido no cancelado cae en un slot del día) o "Lo antes
 * posible" (el primer slot), y avisa al padre por `onSelect` sin esperar un
 * click — igual que el prototipo aprobado, donde el readout y el botón de
 * confirmar ya muestran un horario válido apenas cargan los slots.
 */
export function PickupTimePicker({ fecha, isToday, dayShortLabel, lastUsedTimeOfDay, onSelect, jumpTo = null }: Props) {
  const { data: slots, isLoading, isError, refetch } = useQuery({
    queryKey: ['pickupSlots', fecha],
    queryFn: () => getPickupSlots(fecha),
  });

  const slotsInfo = useMemo<SlotInfo[]>(
    () => (slots ?? []).map((iso) => ({ iso, ...timeOfDay(iso) })),
    [slots],
  );

  const hours = useMemo(
    () => Array.from(new Set(slotsInfo.map((s) => s.h))).sort((a, b) => a - b),
    [slotsInfo],
  );

  const minutesForHour = (h: number) =>
    slotsInfo.filter((s) => s.h === h).map((s) => s.m).sort((a, b) => a - b);

  const lastUsedMatch = useMemo(() => {
    if (!lastUsedTimeOfDay) return null;
    const match = lastUsedTimeOfDay.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return slotsInfo.find((s) => s.h === h && s.m === m) ?? null;
  }, [lastUsedTimeOfDay, slotsInfo]);

  const firstOption = lastUsedMatch ?? slotsInfo[0] ?? null;
  const isLastUsed = !!lastUsedMatch;

  const [mode, setMode] = useState<'auto' | 'custom'>('auto');
  const [customH, setCustomH] = useState<number | null>(null);
  const [customM, setCustomM] = useState<number | null>(null);

  // Cambiar de día invalida cualquier selección manual del día anterior —
  // volvemos a la opción automática (última utilizada / lo antes posible).
  // Ajuste de estado durante el render (patrón recomendado por React para
  // "resetear estado cuando cambia una prop"), no en un efecto: evita el
  // render en cascada que produciría un `setState` síncrono dentro de un
  // `useEffect`.
  const [fechaForMode, setFechaForMode] = useState(fecha);
  if (fecha !== fechaForMode) {
    setFechaForMode(fecha);
    setMode('auto');
    setCustomH(null);
    setCustomM(null);
  }

  // Atajo de la hoja de revisión: ajuste de estado durante el render (mismo
  // patrón que el reseteo por `fecha`) al recibir un pedido de salto nuevo.
  const [handledJump, setHandledJump] = useState<Props['jumpTo']>(null);
  // F21.1: el horario del salto ya no está entre los slots cargados.
  const [jumpMissed, setJumpMissed] = useState(false);
  if (jumpTo && jumpTo !== handledJump && slotsInfo.length > 0) {
    setHandledJump(jumpTo);
    const target = timeOfDay(jumpTo.pickupAt);
    const match = slotsInfo.find((s) => s.h === target.h && s.m === target.m);
    if (match) {
      setCustomH(match.h);
      setCustomM(match.m);
      setMode('custom');
      setJumpMissed(false);
    } else {
      setJumpMissed(true);
    }
  }

  const customSlot = useMemo(() => {
    if (customH === null || customM === null) return null;
    return slotsInfo.find((s) => s.h === customH && s.m === customM) ?? null;
  }, [customH, customM, slotsInfo]);

  // Si los slots se refrescan y el horario elegido a mano ya no está entre
  // las opciones, el radio "Elegir horario" quedaría marcado mostrando un
  // horario que dejó de ser válido, mientras `effective` (y por lo tanto lo
  // que se manda a `onSelect`) ya cayó a la primera opción. Re-sincronizamos
  // volviendo el radio a la opción automática — mismo patrón de ajuste de
  // estado durante el render que el reseteo por cambio de `fecha` de arriba.
  const customSlotWentStale =
    mode === 'custom' && customH !== null && customM !== null && !customSlot && !isLoading && slotsInfo.length > 0;
  if (customSlotWentStale) {
    setMode('auto');
    setCustomH(null);
    setCustomM(null);
  }

  const effective = mode === 'custom' && customSlot ? customSlot : firstOption;

  useEffect(() => {
    if (effective) onSelect(effective.iso);
    // Solo nos importa cuándo cambia el slot efectivo, no la identidad de `onSelect`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective?.iso]);

  if (isError) {
    return (
      <div className="space-y-2 rounded-md bg-muted px-3.5 py-3">
        <p className="text-sm text-foreground">No pudimos cargar los horarios de retiro.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="h-11 rounded-md border border-primary-deep px-3.5 text-sm font-bold text-primary-deep"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!isLoading && slotsInfo.length === 0) {
    return (
      <p className="rounded-md bg-muted px-3.5 py-3 text-sm text-foreground">
        No quedan horarios de retiro para este día. Elegí otro día.
      </p>
    );
  }

  if (isLoading || !firstOption) {
    return <p className="text-sm text-muted-foreground">Cargando horarios…</p>;
  }

  const shownH = mode === 'custom' && customH !== null ? customH : effective!.h;
  const shownM = mode === 'custom' && customM !== null ? customM : effective!.m;
  const minuteOptions = minutesForHour(shownH);

  const handleHourChange = (h: number) => {
    const mins = minutesForHour(h);
    const nextM = mins.includes(shownM) ? shownM : (mins[0] ?? shownM);
    setCustomH(h);
    setCustomM(nextM);
    setMode('custom');
  };

  const handleMinuteChange = (m: number) => {
    setCustomH(shownH);
    setCustomM(m);
    setMode('custom');
  };

  const activateCustom = () => {
    if (mode === 'auto') {
      setCustomH(effective!.h);
      setCustomM(effective!.m);
      setMode('custom');
    }
  };

  const readoutLabel = formatHM(effective!.h, effective!.m);
  const readoutText =
    (isToday ? 'Retirás hoy a las ' : `Retirás el ${dayShortLabel} a las `) +
    readoutLabel +
    (mode === 'auto' && isLastUsed ? ', la última utilizada' : '');

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Horario de retiro" className="flex flex-col gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'auto'}
          onClick={() => setMode('auto')}
          className={cn(
            'flex min-h-[52px] items-center gap-2.5 rounded-lg border-2 px-3.5',
            mode === 'auto'
              ? 'border-primary-deep bg-card text-foreground'
              : 'border-border bg-card text-muted-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2',
              mode === 'auto' ? 'border-primary-deep' : 'border-muted-foreground',
            )}
          >
            {mode === 'auto' && <span className="h-2.5 w-2.5 rounded-full bg-primary-deep" />}
          </span>
          {isLastUsed ? (
            <History className="h-[18px] w-[18px] shrink-0 text-primary-deep" aria-hidden="true" />
          ) : (
            <Zap className="h-[18px] w-[18px] shrink-0 text-primary-deep" aria-hidden="true" />
          )}
          <span className="flex-1 text-left text-sm font-bold">
            {isLastUsed ? 'Última utilizada' : 'Lo antes posible'}
          </span>
          <span className="text-base font-bold">{formatHM(firstOption.h, firstOption.m)}</span>
        </button>

        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border-2 px-3.5 py-1.5',
            mode === 'custom' ? 'border-primary-deep bg-card' : 'border-border bg-card',
          )}
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'custom'}
            onClick={activateCustom}
            className="flex min-h-[44px] flex-1 items-center gap-2.5 text-left text-sm font-bold text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2',
                mode === 'custom' ? 'border-primary-deep' : 'border-muted-foreground',
              )}
            >
              {mode === 'custom' && <span className="h-2.5 w-2.5 rounded-full bg-primary-deep" />}
            </span>
            Elegir horario
          </button>

          <div className={cn('flex items-center gap-1', mode === 'auto' && 'opacity-50')}>
            <label htmlFor="pickup-hour" className="sr-only">
              Hora de retiro
            </label>
            <select
              id="pickup-hour"
              value={shownH}
              onClick={activateCustom}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              className="h-11 w-[68px] rounded-md border border-border bg-background px-2 text-base font-bold text-foreground"
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="text-lg font-bold text-foreground">
              :
            </span>
            <label htmlFor="pickup-minute" className="sr-only">
              Minutos
            </label>
            <select
              id="pickup-minute"
              value={shownM}
              onClick={activateCustom}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              className="h-11 w-[68px] rounded-md border border-border bg-background px-2 text-base font-bold text-foreground"
            >
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {readoutText}
      </p>
      {jumpMissed && (
        <p role="alert" className="text-sm text-muted-foreground">
          Ese horario ya no está disponible. Elegí otro.
        </p>
      )}
    </div>
  );
}
