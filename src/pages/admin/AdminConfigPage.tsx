import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarOff, Check, Clock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDisabledDates } from '@/features/orders/services/ordersApi';
import {
  createDisabledDate,
  deleteDisabledDate,
  getRestaurantConfigAdmin,
  updateRestaurantConfig,
  type RestaurantConfig,
  type UpdateRestaurantConfigPayload,
} from '@/features/admin/services/adminApi';

function toPayload(c: RestaurantConfig): UpdateRestaurantConfigPayload {
  return {
    horaCorte: c.horaCorte,
    pickupLeadMinutes: c.pickupLeadMinutes,
    creditExpiryDays: c.creditExpiryDays,
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
    <div className="p-6 lg:p-10 max-w-2xl">
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
          <Label htmlFor="pickupWindowStart" className="uppercase tracking-brand text-xs">
            Apertura de la ventana de retiro
          </Label>
          <Input
            id="pickupWindowStart"
            type="time"
            step={60}
            value={form.pickupWindowStart}
            onChange={(e) => setField('pickupWindowStart', e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div>
          <Label htmlFor="pickupWindowEnd" className="uppercase tracking-brand text-xs">
            Cierre de la ventana de retiro
          </Label>
          <Input
            id="pickupWindowEnd"
            type="time"
            step={60}
            value={form.pickupWindowEnd}
            onChange={(e) => setField('pickupWindowEnd', e.target.value)}
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
      <p className="text-xs text-muted-foreground -mt-2">
        La ventana de retiro debe abrir antes de cerrar — el backend rechaza el guardado si no.
      </p>

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
