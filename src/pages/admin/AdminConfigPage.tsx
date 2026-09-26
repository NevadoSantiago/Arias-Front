import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarOff, Check, Clock, Copy, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getDisabledDates } from '@/features/orders/services/ordersApi';
import {
  createDisabledDate,
  deleteDisabledDate,
  getRestaurantConfigAdmin,
  updatePickupSchedule,
  updateRestaurantConfig,
  type PickupScheduleDay,
  type RestaurantConfig,
  type UpdatePickupScheduleDayPayload,
  type UpdateRestaurantConfigPayload,
} from '@/features/admin/services/adminApi';

function toPayload(c: RestaurantConfig): UpdateRestaurantConfigPayload {
  return {
    horaCorte: c.horaCorte,
    pickupLeadMinutes: c.pickupLeadMinutes,
    creditExpiryDays: c.creditExpiryDays,
    // DEPRECATED: ya no se editan acá (reemplazados por la franja por día,
    // B5/F14) pero `UpdateRestaurantConfigRequest` los sigue exigiendo con
    // `@NotNull` — se manda el valor vigente leído de la config para que el
    // PUT existente siga funcionando sin tocar el backend.
    pickupWindowStart: c.pickupWindowStart,
    pickupWindowEnd: c.pickupWindowEnd,
    pickupSlotMinutes: c.pickupSlotMinutes,
    dailySummaryTime: c.dailySummaryTime,
    pickupReminderMinutes: c.pickupReminderMinutes,
  };
}

export function AdminConfigPage() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['restaurantConfigAdmin'],
    queryFn: getRestaurantConfigAdmin,
  });

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <header className="mb-8">
        <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm">
          Ajustes globales del restaurant.
        </p>
      </header>

      {isLoading && (
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-8">
          Cargando…
        </p>
      )}

      {/* `config` recién existe con datos completos — se le pasa como prop
          (no vía effect) para que el form inicialice su estado local una
          sola vez, sin sincronizar estado con un efecto. */}
      {config && <RestaurantConfigForm config={config} />}

      {config && <PickupScheduleCard config={config} />}

      <DisabledDatesSection />
    </div>
  );
}

/**
 * Formulario de edición — recibe el snapshot ya cargado como prop e
 * inicializa su estado local a partir de él (sin `useEffect`). Después de
 * guardar, sincroniza el estado local con la respuesta del PUT directamente
 * en el `onSuccess` de la mutación (un event handler, no un efecto).
 */
function RestaurantConfigForm({ config }: { config: RestaurantConfig }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateRestaurantConfigPayload>(() => toPayload(config));
  const [baseline, setBaseline] = useState<UpdateRestaurantConfigPayload>(() => toPayload(config));
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: UpdateRestaurantConfigPayload) => updateRestaurantConfig(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['restaurantConfigAdmin'], data);
      const payload = toPayload(data);
      setForm(payload);
      setBaseline(payload);
      setSaved(true);
      // Apagar el feedback "Guardado" después de 2 segundos
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const isSaving = mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;
    mutation.mutate(form);
  };

  const setField = <K extends keyof UpdateRestaurantConfigPayload>(
    key: K,
    value: UpdateRestaurantConfigPayload[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const setMinutesField = <K extends 'pickupLeadMinutes' | 'creditExpiryDays' | 'pickupSlotMinutes' | 'pickupReminderMinutes'>(
    key: K,
    raw: string,
  ) => setField(key, Math.max(1, Math.floor(Number(raw) || 1)));

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-lg p-6 lg:p-8 space-y-6"
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <Label htmlFor="horaCorte" className="uppercase tracking-brand text-xs">
            Hora de corte de pedidos
          </Label>
        </div>
        <Input
          id="horaCorte"
          type="time"
          value={form.horaCorte}
          onChange={(e) => setField('horaCorte', e.target.value)}
          disabled={isSaving}
          className="max-w-[200px]"
          step={60}
        />
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Después de este horario, los empleados ya no pueden hacer ni modificar
          pedidos para el día actual. El cron de cierre cambia automáticamente
          todos los pedidos pendientes a "Confirmado" cuando llega esta hora.
        </p>
      </div>

      {/* Campos B2C (unidad 8 del backend): tiempo de preparación, vencimiento
          de almuerzos y ventana de pedidos. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-border">
        <div>
          <Label htmlFor="pickupLeadMinutes" className="uppercase tracking-brand text-xs">
            Tiempo de preparación (min)
          </Label>
          <Input
            id="pickupLeadMinutes"
            type="number"
            min={1}
            value={form.pickupLeadMinutes}
            onChange={(e) => setMinutesField('pickupLeadMinutes', e.target.value)}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Retiro más temprano ofrecido y momento en que se consume el almuerzo automáticamente.
          </p>
        </div>

        <div>
          <Label htmlFor="creditExpiryDays" className="uppercase tracking-brand text-xs">
            Vencimiento de almuerzos (días)
          </Label>
          <Input
            id="creditExpiryDays"
            type="number"
            min={1}
            value={form.creditExpiryDays}
            onChange={(e) => setMinutesField('creditExpiryDays', e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div>
          <Label htmlFor="pickupSlotMinutes" className="uppercase tracking-brand text-xs">
            Intervalo entre horarios de retiro (min)
          </Label>
          <Input
            id="pickupSlotMinutes"
            type="number"
            min={1}
            value={form.pickupSlotMinutes}
            onChange={(e) => setMinutesField('pickupSlotMinutes', e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div>
          <Label htmlFor="dailySummaryTime" className="uppercase tracking-brand text-xs">
            Resumen matutino de cocina
          </Label>
          <Input
            id="dailySummaryTime"
            type="time"
            step={60}
            value={form.dailySummaryTime}
            onChange={(e) => setField('dailySummaryTime', e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div>
          <Label htmlFor="pickupReminderMinutes" className="uppercase tracking-brand text-xs">
            Recordatorio de retiro (min antes)
          </Label>
          <Input
            id="pickupReminderMinutes"
            type="number"
            min={1}
            value={form.pickupReminderMinutes}
            onChange={(e) => setMinutesField('pickupReminderMinutes', e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <Button
          type="submit"
          disabled={!isDirty || isSaving}
          className="uppercase tracking-brand font-medium"
        >
          {isSaving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {isDirty && !isSaving && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setForm(baseline)}
            className="uppercase tracking-brand text-xs"
          >
            Descartar
          </Button>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-success uppercase tracking-brand">
            <Check className="w-3.5 h-3.5" />
            Guardado
          </span>
        )}
        {mutation.isError && (
          <span className="text-xs text-destructive">
            Error al guardar. Probá de nuevo.
          </span>
        )}
      </div>
    </form>
  );
}

// ─── Horarios de retiro por día de la semana (B5/F14) ──────────────────

const SCHEDULE_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};
/** Lunes a viernes — a dónde copia "Copiar a días hábiles" (excluye lunes, la fuente). */
const WEEKDAY_TARGETS = [2, 3, 4, 5];

/**
 * Sin `pickupSchedule` (backend anterior a V24) se parte de la franja global
 * con todos los días abiertos, que es lo que el backend aplica en ese caso.
 * Mostrarlos cerrados haría que un "Guardar" cierre el local toda la semana.
 */
function toScheduleForm(config: RestaurantConfig): PickupScheduleDay[] {
  const byDay = new Map((config.pickupSchedule ?? []).map((d) => [d.dayOfWeek, d]));
  const fallback = (dayOfWeek: number): PickupScheduleDay => ({
    dayOfWeek,
    open: true,
    windowStart: config.pickupWindowStart?.slice(0, 5) ?? null,
    windowEnd: config.pickupWindowEnd?.slice(0, 5) ?? null,
  });
  return SCHEDULE_DAYS.map((dayOfWeek) => byDay.get(dayOfWeek) ?? fallback(dayOfWeek));
}

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isDayInvalid(d: PickupScheduleDay): boolean {
  if (!d.open) return false;
  const a = toMinutes(d.windowStart);
  const b = toMinutes(d.windowEnd);
  return a === null || b === null || b <= a;
}

function daySummary(d: PickupScheduleDay, invalid: boolean): string {
  if (!d.open) return 'Cerrado: no se ofrece para pedir';
  if (invalid) return 'Franja inválida';
  const a = toMinutes(d.windowStart)!;
  const b = toMinutes(d.windowEnd)!;
  const hours = (b - a) / 60;
  const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
  return `${d.windowStart} a ${d.windowEnd} · ${hoursLabel} h`;
}

function toSchedulePayload(days: PickupScheduleDay[]): UpdatePickupScheduleDayPayload[] {
  return days.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    open: d.open,
    windowStart: d.open ? d.windowStart : null,
    windowEnd: d.open ? d.windowEnd : null,
  }));
}

function PickupScheduleCard({ config }: { config: RestaurantConfig }) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<PickupScheduleDay[]>(() => toScheduleForm(config));
  const [baseline, setBaseline] = useState<PickupScheduleDay[]>(() => toScheduleForm(config));
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: UpdatePickupScheduleDayPayload[]) => updatePickupSchedule(payload),
    onSuccess: (data) => {
      setDays(data);
      setBaseline(data);
      setSaved(true);
      setCopied(false);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['restaurantConfigAdmin'] });
      queryClient.invalidateQueries({ queryKey: ['restaurantConfig'] });
    },
  });

  const isDirty = JSON.stringify(days) !== JSON.stringify(baseline);
  const isSaving = mutation.isPending;
  const invalidByDay = days.map(isDayInvalid);
  const anyInvalid = invalidByDay.some(Boolean);
  const mondayInvalid = invalidByDay[0];
  const canSave = isDirty && !anyInvalid && !isSaving;

  const updateDay = (dayOfWeek: number, patch: Partial<PickupScheduleDay>) => {
    setDays((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
    setCopied(false);
  };

  const handleSave = () => {
    if (!canSave) return;
    mutation.mutate(toSchedulePayload(days));
  };

  const handleDiscard = () => {
    setDays(baseline);
    setCopied(false);
  };

  const handleCopyToWeekdays = () => {
    if (mondayInvalid) return;
    const monday = days[0];
    setDays((prev) =>
      prev.map((d) =>
        WEEKDAY_TARGETS.includes(d.dayOfWeek)
          ? { ...d, open: monday.open, windowStart: monday.windowStart, windowEnd: monday.windowEnd }
          : d,
      ),
    );
    setCopied(true);
  };

  return (
    <div
      role="region"
      aria-labelledby="pickup-schedule-title"
      className="bg-card border border-border rounded-lg p-6 lg:p-8 space-y-6 mt-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary" />
            <h2 id="pickup-schedule-title" className="uppercase tracking-brand text-xs font-medium text-foreground">
              Horarios de retiro
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            Los clientes solo pueden elegir un horario de retiro dentro de la franja de cada día, cada{' '}
            {config.pickupSlotMinutes} minutos. Los días cerrados no se ofrecen para pedir.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyToWeekdays}
          disabled={mondayInvalid || isSaving}
          className="uppercase tracking-brand text-xs shrink-0"
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          Copiar a días hábiles
        </Button>
      </div>
      {copied && (
        <p className="-mt-4 text-xs text-success">Copiado a martes–viernes</p>
      )}

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-collapse text-sm min-w-[640px]">
          <caption className="sr-only">Horario de retiro por día</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                Día
              </th>
              <th scope="col" className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                Estado
              </th>
              <th scope="col" className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                Desde
              </th>
              <th scope="col" className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                Hasta
              </th>
              <th scope="col" className="py-2 px-3 text-left text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                Franja del día
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const invalid = invalidByDay[i];
              const name = WEEKDAY_NAMES[d.dayOfWeek];
              const a = toMinutes(d.windowStart);
              const b = toMinutes(d.windowEnd);
              const left = a !== null ? (a / 1440) * 100 : 0;
              const width = d.open && !invalid && a !== null && b !== null ? ((b - a) / 1440) * 100 : 0;
              const errId = `pickup-schedule-error-${d.dayOfWeek}`;

              return (
                <tr key={d.dayOfWeek} className={cn('border-b border-border last:border-0', !d.open && 'bg-muted/30')}>
                  <th scope="row" className="py-3 px-3 text-left font-semibold whitespace-nowrap">
                    {name}
                  </th>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`pickup-open-${d.dayOfWeek}`}
                        checked={d.open}
                        onCheckedChange={(v) => updateDay(d.dayOfWeek, { open: v })}
                        disabled={isSaving}
                        aria-label={`${name}: ${d.open ? 'abierto' : 'cerrado'}`}
                      />
                      <Label htmlFor={`pickup-open-${d.dayOfWeek}`} className="text-xs font-semibold">
                        {d.open ? 'Abierto' : 'Cerrado'}
                      </Label>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <Label htmlFor={`pickup-from-${d.dayOfWeek}`} className="sr-only">
                      {`${name}, desde`}
                    </Label>
                    <Input
                      id={`pickup-from-${d.dayOfWeek}`}
                      type="time"
                      step={60}
                      value={d.windowStart ?? ''}
                      onChange={(e) => updateDay(d.dayOfWeek, { windowStart: e.target.value || null })}
                      disabled={!d.open || isSaving}
                      className="w-[130px]"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <Label htmlFor={`pickup-to-${d.dayOfWeek}`} className="sr-only">
                      {`${name}, hasta`}
                    </Label>
                    <Input
                      id={`pickup-to-${d.dayOfWeek}`}
                      type="time"
                      step={60}
                      value={d.windowEnd ?? ''}
                      onChange={(e) => updateDay(d.dayOfWeek, { windowEnd: e.target.value || null })}
                      disabled={!d.open || isSaving}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? errId : undefined}
                      className={cn('w-[130px]', invalid && 'border-destructive')}
                    />
                    {invalid && (
                      <p id={errId} role="alert" className="mt-1 text-xs text-destructive">
                        &ldquo;Hasta&rdquo; tiene que ser después de &ldquo;Desde&rdquo;.
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 min-w-[160px]">
                    <div className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="absolute inset-y-0 rounded-full bg-primary"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{daySummary(d, invalid)}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="uppercase tracking-brand font-medium"
        >
          {isSaving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {isDirty && !isSaving && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDiscard}
            className="uppercase tracking-brand text-xs"
          >
            Descartar
          </Button>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-success uppercase tracking-brand">
            <Check className="w-3.5 h-3.5" />
            Guardado
          </span>
        )}
        {mutation.isError && (
          <span className="text-xs text-destructive">
            Error al guardar. Probá de nuevo.
          </span>
        )}
      </div>
    </div>
  );
}

function DisabledDatesSection() {
  const queryClient = useQueryClient();
  const [newFecha, setNewFecha] = useState('');
  const [newMotivo, setNewMotivo] = useState('');

  const { data: dates, isLoading } = useQuery({
    queryKey: ['disabledDates'],
    queryFn: () => getDisabledDates(),
  });

  const addMutation = useMutation({
    mutationFn: () => createDisabledDate(newFecha, newMotivo || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabledDates'] });
      setNewFecha('');
      setNewMotivo('');
      toast.success('Fecha deshabilitada agregada');
    },
    onError: () => {
      toast.error('No se pudo agregar la fecha');
    },
  });

  const removeMutation = useMutation({
    mutationFn: deleteDisabledDate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabledDates'] });
      toast.success('Fecha habilitada nuevamente');
    },
    onError: () => {
      toast.error('No se pudo eliminar la fecha');
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFecha || addMutation.isPending) return;
    addMutation.mutate();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 lg:p-8 space-y-6 mt-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarOff className="w-4 h-4 text-primary" />
          <h2 className="uppercase tracking-brand text-xs font-medium text-foreground">
            Fechas deshabilitadas
          </h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Días en los que el restaurant no recibe pedidos.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
        <Input
          type="date"
          value={newFecha}
          onChange={(e) => setNewFecha(e.target.value)}
          className="max-w-[180px]"
          required
        />
        <Input
          type="text"
          placeholder="Motivo (opcional)"
          value={newMotivo}
          onChange={(e) => setNewMotivo(e.target.value)}
          maxLength={200}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!newFecha || addMutation.isPending}
          className="uppercase tracking-brand font-medium shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar
        </Button>
      </form>

      {isLoading && (
        <p className="text-xs text-muted-foreground uppercase tracking-brand">Cargando...</p>
      )}

      {!isLoading && dates && dates.length === 0 && (
        <p className="text-xs text-muted-foreground">No hay fechas deshabilitadas.</p>
      )}

      {dates && dates.length > 0 && (
        <ul className="space-y-2">
          {dates.map((d) => (
            <li
              key={d.fecha}
              className="flex items-center justify-between gap-3 px-4 py-3 bg-background border border-border rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-foreground shrink-0">
                  {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                {d.motivo && (
                  <span className="text-xs text-muted-foreground truncate">{d.motivo}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(d.fecha)}
              >
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
