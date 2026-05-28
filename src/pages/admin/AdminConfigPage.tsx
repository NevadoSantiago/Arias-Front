import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarOff, Check, Clock, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDisabledDates, getRestaurantConfig } from '@/features/orders/services/ordersApi';
import { createDisabledDate, deleteDisabledDate, updateRestaurantConfig } from '@/features/admin/services/adminApi';

export function AdminConfigPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['restaurantConfig'],
    queryFn: getRestaurantConfig,
  });

  const [horaCorte, setHoraCorte] = useState('');
  const [saved, setSaved] = useState(false);

  // Sincronizar el form con el valor del back cuando carga
  useEffect(() => {
    if (config?.horaCorte) setHoraCorte(config.horaCorte);
  }, [config]);

  const mutation = useMutation({
    mutationFn: (value: string) => updateRestaurantConfig(value),
    onSuccess: (data) => {
      queryClient.setQueryData(['restaurantConfig'], { horaCorte: data.horaCorte });
      setSaved(true);
      // Apagar el feedback "Guardado" después de 2 segundos
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const isDirty = config !== undefined && horaCorte !== config.horaCorte;
  const isSaving = mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;
    mutation.mutate(horaCorte);
  };

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
            value={horaCorte}
            onChange={(e) => setHoraCorte(e.target.value)}
            disabled={isLoading || isSaving}
            className="max-w-[200px]"
            step={60}
          />
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Después de este horario, los empleados ya no pueden hacer ni modificar
            pedidos para el día actual. El cron de cierre cambia automáticamente
            todos los pedidos pendientes a "Confirmado" cuando llega esta hora.
          </p>
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
              onClick={() => setHoraCorte(config?.horaCorte ?? '')}
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

      <DisabledDatesSection />
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
