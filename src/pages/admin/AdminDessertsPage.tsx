import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake, Info, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  createDessert, disableDessert, enableDessert, listDessertsAdmin, updateDessert,
  type AdminDessert,
} from '@/features/admin/services/dessertsApi';
import { DishPhotoUploader } from '@/features/admin/components/DishPhotoUploader';
import { Th, Td, EmptyState } from './AdminSectionsPage';

interface FormState {
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  stock: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = { nombre: '', descripcion: '', fotoUrl: null, stock: '', enabled: true };

function formFrom(d: AdminDessert | null): FormState {
  if (!d) return EMPTY_FORM;
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    fotoUrl: d.fotoUrl,
    stock: String(d.stockDiarioDefault),
    enabled: d.enabled,
  };
}

export function AdminDessertsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminDessert | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ nombre?: string; stock?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState('');

  const { data: desserts, isLoading } = useQuery({
    queryKey: ['adminDesserts'],
    queryFn: listDessertsAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['adminDesserts'] });

  const toggleMutation = useMutation({
    mutationFn: (d: AdminDessert) => (d.enabled ? disableDessert(d.id) : enableDessert(d.id)),
    onSuccess: (_r, d) => {
      void refresh();
      if (editing?.id === d.id) setForm((f) => ({ ...f, enabled: !d.enabled }));
    },
    onError: (err: Error) => setServerError(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const base = {
        nombre: f.nombre.trim(),
        ...(f.descripcion.trim() && { descripcion: f.descripcion.trim() }),
        ...(f.fotoUrl && { fotoUrl: f.fotoUrl }),
        stockDiarioDefault: Number(f.stock),
      };
      if (editing) {
        return updateDessert(editing.id, { ...base, enabled: f.enabled });
      }
      const created = await createDessert(base);
      // The create endpoint always enables; honour an "off" switch right away.
      if (!f.enabled) await disableDessert(created.id);
      return created;
    },
    onSuccess: () => {
      void refresh();
      const wasEditing = editing !== null;
      if (!wasEditing) {
        // After creating, the panel goes back to an empty form, ready to add another dessert.
        setForm(EMPTY_FORM);
        setErrors({});
      }
      setSaved(wasEditing ? 'Cambios guardados.' : 'Postre creado.');
    },
    onError: (err: Error) => setServerError(err.message || 'No se pudo guardar el postre'),
  });

  const startNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(null);
    setSaved('');
  };

  const startEdit = (d: AdminDessert) => {
    setEditing(d);
    setForm(formFrom(d));
    setErrors({});
    setServerError(null);
    setSaved('');
  };

  const patch = (p: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...p }));
    setSaved('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.nombre.trim()) next.nombre = 'Ingresá el nombre del postre';
    const stock = Number(form.stock);
    if (form.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) {
      next.stock = 'Ingresá un stock diario de 0 o más';
    }
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) return;
    saveMutation.mutate(form);
  };

  const total = desserts?.length ?? 0;

  return (
    <div className="p-6 lg:p-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-foreground text-3xl lg:text-4xl font-bold leading-tight mb-1">
            Postres
          </h1>
          <p className="text-muted-foreground text-sm">
            Los postres que el cliente puede elegir cuando canjea su postre de regalo.
          </p>
        </div>
        <Button onClick={startNew} className="uppercase tracking-brand font-medium self-start">
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo postre
        </Button>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3 mb-6 text-[13.5px] leading-relaxed">
        <Info className="w-[18px] h-[18px] shrink-0 mt-0.5 text-accent-foreground" aria-hidden="true" />
        <span>
          Los postres <strong>no aparecen en el menú</strong>. Solo se muestran al cliente que tiene un
          postre de regalo, cuando lo suma a un pedido de almuerzo. El stock diario se descuenta con
          cada canje.
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Lista de postres" className="flex-[999_1_520px] min-w-0">
          {isLoading && (
            <p className="text-center text-muted-foreground text-sm uppercase tracking-brand py-12">Cargando…</p>
          )}
          {!isLoading && total === 0 && <EmptyState message="Sin postres todavía" />}
          {total > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <Th>Foto</Th>
                      <Th>Nombre</Th>
                      <Th>Stock hoy</Th>
                      <Th>Estado</Th>
                      <Th className="text-right">Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {desserts!.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          'border-b border-border last:border-0',
                          !d.enabled && 'opacity-50',
                          editing?.id === d.id && 'bg-background',
                        )}
                      >
                        <Td><DessertThumb fotoUrl={d.fotoUrl} alt={d.nombre} /></Td>
                        <Td>
                          <div className="font-medium text-foreground">{d.nombre}</div>
                          <div className="text-xs text-muted-foreground">{d.descripcion || '—'}</div>
                        </Td>
                        <Td className="text-xs whitespace-nowrap">
                          <span className={cn('font-semibold', d.stockActual === 0 ? 'text-destructive' : 'text-foreground')}>
                            {d.stockActual}
                          </span>
                          <span className="text-muted-foreground"> / {d.stockDiarioDefault}</span>
                        </Td>
                        <Td>
                          <Badge
                            className={cn(
                              'uppercase tracking-brand text-[10px]',
                              d.enabled ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {d.enabled ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8"
                              aria-label={`Editar ${d.nombre}`}
                              onClick={() => startEdit(d)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8"
                              aria-label={`${d.enabled ? 'Desactivar' : 'Activar'} ${d.nombre}`}
                              disabled={toggleMutation.isPending}
                              onClick={() => toggleMutation.mutate(d)}
                            >
                              {d.enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <form
          onSubmit={submit}
          noValidate
          aria-label={editing ? 'Editar postre' : 'Nuevo postre'}
          className="flex-[1_1_380px] max-w-[460px] min-w-0 bg-card border border-border rounded-lg p-6 flex flex-col gap-[18px]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold">{editing ? 'Editar postre' : 'Nuevo postre'}</h2>
            <span className="text-[11px] uppercase tracking-brand text-muted-foreground">
              {editing ? 'Editando' : 'Creando'}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dessert-name" className="uppercase tracking-brand text-xs">Nombre</Label>
            <Input
              id="dessert-name"
              value={form.nombre}
              onChange={(e) => patch({ nombre: e.target.value })}
              placeholder="Nombre del postre"
            />
            {errors.nombre && <p className="text-destructive text-xs">{errors.nombre}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dessert-desc" className="uppercase tracking-brand text-xs">Descripción</Label>
            <Textarea
              id="dessert-desc"
              rows={3}
              value={form.descripcion}
              onChange={(e) => patch({ descripcion: e.target.value })}
              placeholder="Descripción corta que ve el cliente"
            />
          </div>

          <div className="space-y-1.5">
            <span className="block uppercase tracking-brand text-xs font-medium">Foto</span>
            <DishPhotoUploader value={form.fotoUrl} onChange={(url) => patch({ fotoUrl: url })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dessert-stock" className="uppercase tracking-brand text-xs">Stock diario</Label>
            <Input
              id="dessert-stock"
              type="number"
              min={0}
              className="w-36"
              value={form.stock}
              onChange={(e) => patch({ stock: e.target.value })}
              placeholder="N"
            />
            <p className="text-xs text-muted-foreground">
              Cuántos se pueden canjear por día. Se repone cada mañana.
            </p>
            {errors.stock && <p className="text-destructive text-xs">{errors.stock}</p>}
          </div>

          <div className="flex flex-col gap-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span id="lbl-enabled" className="block text-sm font-semibold">Habilitado</span>
                <span className="block text-xs text-muted-foreground">
                  Si está apagado, el cliente no lo ve al canjear.
                </span>
              </div>
              <Switch
                aria-labelledby="lbl-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => patch({ enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span id="lbl-menu" className="block text-sm font-semibold text-muted-foreground">
                  Visible en el menú
                </span>
                <span className="block text-xs text-muted-foreground">
                  Próximamente: vender postres en pesos desde el menú.
                </span>
              </div>
              <Switch aria-labelledby="lbl-menu" checked={false} disabled />
            </div>
          </div>

          {serverError && (
            <p role="alert" className="text-destructive text-sm">{serverError}</p>
          )}

          <div className="flex gap-2.5">
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1 uppercase tracking-brand font-medium">
              Guardar
            </Button>
            <Button type="button" variant="outline" onClick={startNew} className="font-semibold">
              Cancelar
            </Button>
          </div>
          {saved && <span role="status" className="text-[13px] font-semibold text-success">{saved}</span>}
        </form>
      </div>
    </div>
  );
}

function DessertThumb({ fotoUrl, alt }: { fotoUrl: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!fotoUrl || failed) {
    return (
      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
        <Cake className="w-4 h-4 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img src={fotoUrl} alt={alt} className="w-12 h-12 rounded-md object-cover" onError={() => setFailed(true)} />
  );
}
