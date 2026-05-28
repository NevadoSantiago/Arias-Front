import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  createDish, updateDish, listCategories, listSidesAdmin,
  type AdminDish, type AdminCategory, type AdminSide, type SideType,
} from '@/features/admin/services/adminApi';
import { listMenuSectionsAdmin, type AdminMenuSection } from '@/features/admin/services/adminApi';
import { DishPhotoUploader } from '@/features/admin/components/DishPhotoUploader';

// ─── Schema ────────────────────────────────────────────────────────────

const schema = z.object({
  nombre: z.string().min(1, 'Requerido').max(150),
  descripcion: z.string().max(2000).optional().or(z.literal('')),
  fotoUrl: z.string().max(500).optional().or(z.literal('')),
  categoryId: z.number().int().positive('Elegí una categoría'),
  menuSectionId: z.number().int().positive('Elegí una sección'),
  sideType: z.enum(['NONE', 'GUARNICION', 'SALSA']),
  allowedSideIds: z.array(z.number()),
  stockDiarioDefault: z.number().int().min(0, 'Mayor o igual a 0'),
  stockActual: z.number().int().min(0, 'Mayor o igual a 0'),
  enabled: z.boolean(),
  especial: z.boolean(),
  diasSemana: z.array(z.string()),
});
type FormData = z.infer<typeof schema>;

const DIAS = [
  { value: 'LUNES', label: 'Lu' },
  { value: 'MARTES', label: 'Ma' },
  { value: 'MIERCOLES', label: 'Mi' },
  { value: 'JUEVES', label: 'Ju' },
  { value: 'VIERNES', label: 'Vi' },
  { value: 'SABADO', label: 'Sa' },
  { value: 'DOMINGO', label: 'Do' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: AdminDish | null;
}

export function DishFormDialog({ open, onClose, editing }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);

  // Cargas auxiliares (solo cuando el dialog abre)
  const { data: categories } = useQuery({
    queryKey: ['adminCategories'], queryFn: listCategories, enabled: open,
  });
  const { data: sections } = useQuery({
    queryKey: ['adminMenuSections'], queryFn: listMenuSectionsAdmin, enabled: open,
  });
  const { data: allSides } = useQuery({
    queryKey: ['adminSides'], queryFn: listSidesAdmin, enabled: open,
  });

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  });

  const sideType = watch('sideType');
  const allowedSideIds = watch('allowedSideIds');
  const categoryId = watch('categoryId');
  const menuSectionId = watch('menuSectionId');
  const fotoUrl = watch('fotoUrl');
  const enabled = watch('enabled');
  const especial = watch('especial');
  const diasSemana = watch('diasSemana');

  // Toggle entre uploader (default) y text input (fallback para URLs externas)
  const [manualUrlMode, setManualUrlMode] = useState(false);

  // Reset cuando cambia editing/open
  useEffect(() => {
    if (!open) return;
    reset(editing ? editingToForm(editing) : defaultValues());
    setServerError(null);
  }, [editing, open, reset]);

  // Si cambia el tipo, limpiamos los sides seleccionados (porque ya no son válidos)
  useEffect(() => {
    if (!open) return;
    if (sideType === 'NONE') {
      setValue('allowedSideIds', [], { shouldValidate: false });
    } else {
      // Filtramos los seleccionados que ya no matchean
      const validIds = (allSides ?? [])
        .filter((s) => s.tipo === sideType)
        .map((s) => s.id);
      setValue(
        'allowedSideIds',
        allowedSideIds.filter((id) => validIds.includes(id)),
        { shouldValidate: false }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideType, allSides, open]);

  const filteredSides = (allSides ?? []).filter(
    (s) => s.tipo === sideType && s.enabled
  );

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = formToPayload(data, isEditing);
      if (isEditing && editing) return updateDish(editing.id, payload);
      return createDish(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDishes'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEditing ? 'Editar plato' : 'Nuevo plato'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modificá los datos del plato.'
              : 'El plato va a aparecer en el menú de los empleados con categoría compatible.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => { setServerError(null); mutation.mutate(data); })}
          className="space-y-6"
          noValidate
        >
          {/* ── Switch de disponibilidad — solo al editar ────────────── */}
          {isEditing && (
            <div className={cn(
              'flex items-center justify-between gap-4 p-4 rounded-md border',
              enabled
                ? 'border-success/30 bg-success/5'
                : 'border-destructive/30 bg-destructive/5'
            )}>
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="uppercase tracking-brand text-xs">
                  Disponible en el menú
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {enabled
                    ? 'Los empleados pueden verlo y pedirlo.'
                    : 'Oculto del menú del empleado. Los pedidos pasados quedan intactos.'}
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={(v) => setValue('enabled', v, { shouldDirty: true })}
              />
            </div>
          )}

          {/* ── Identidad ────────────────────────────────────────────── */}
          <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register('nombre')} autoFocus />
          </Field>

          <Field label="Descripción" htmlFor="descripcion" error={errors.descripcion?.message}>
            <Textarea id="descripcion" {...register('descripcion')} rows={2} className="resize-none" />
          </Field>

          <div className="space-y-2">
            <Label className="uppercase tracking-brand text-xs">Foto del plato</Label>
            {manualUrlMode ? (
              <div className="space-y-2">
                <Input
                  {...register('fotoUrl')}
                  placeholder="https://… o /dishes/nombre.jpg"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setManualUrlMode(false)}
                  className="text-[11px] uppercase tracking-brand text-muted-foreground hover:text-primary transition-colors"
                >
                  ← Volver al uploader
                </button>
              </div>
            ) : (
              <>
                <DishPhotoUploader
                  value={fotoUrl}
                  onChange={(url) => setValue('fotoUrl', url ?? '', { shouldValidate: true })}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setManualUrlMode(true)}
                  className="text-[11px] uppercase tracking-brand text-muted-foreground hover:text-primary transition-colors"
                >
                  Prefiero pegar la URL manualmente →
                </button>
              </>
            )}
            {errors.fotoUrl && <p className="text-destructive text-xs">{errors.fotoUrl.message}</p>}
          </div>

          {/* ── Categoría + Sección ─────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Categoría (tier)" htmlFor="categoryId" error={errors.categoryId?.message}
              hint="Quién puede pedirlo">
              <Select
                value={categoryId ? String(categoryId) : ''}
                onValueChange={(v) => setValue('categoryId', Number(v), { shouldValidate: true })}
              >
                <SelectTrigger id="categoryId"><SelectValue placeholder="Elegí…" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c: AdminCategory) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Sección del menú" htmlFor="menuSectionId" error={errors.menuSectionId?.message}
              hint="Dónde aparece (filter pills)">
              <Select
                value={menuSectionId ? String(menuSectionId) : ''}
                onValueChange={(v) => setValue('menuSectionId', Number(v), { shouldValidate: true })}
              >
                <SelectTrigger id="menuSectionId"><SelectValue placeholder="Elegí…" /></SelectTrigger>
                <SelectContent>
                  {sections?.map((s: AdminMenuSection) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* ── Side type + multi-select ────────────────────────────── */}
          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="uppercase tracking-brand text-xs">Acompañamiento</Label>
            <RadioGroup
              value={sideType}
              onValueChange={(v) => setValue('sideType', v as FormData['sideType'])}
              className="flex flex-col gap-2"
            >
              <RadioOption value="NONE" label="Sin acompañamiento" />
              <RadioOption value="GUARNICION" label="Guarnición (papas, ensalada, etc.)" />
              <RadioOption value="SALSA" label="Salsa (bolognesa, filetto, etc.)" />
            </RadioGroup>

            {sideType !== 'NONE' && (
              <div className="space-y-2 pl-1 pt-2">
                <Label className="text-[10px] uppercase tracking-brand text-muted-foreground">
                  Opciones permitidas para este plato
                </Label>
                {filteredSides.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No hay acompañamientos de tipo {sideType.toLowerCase()} disponibles.
                    Creá algunos en "Acompañamientos".
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredSides.map((side: AdminSide) => {
                      const checked = allowedSideIds.includes(side.id);
                      return (
                        <label
                          key={side.id}
                          className="flex items-center gap-2.5 p-2 rounded-md border border-border cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-muted/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              if (c) setValue('allowedSideIds', [...allowedSideIds, side.id]);
                              else setValue('allowedSideIds', allowedSideIds.filter((id) => id !== side.id));
                            }}
                          />
                          <span className="text-sm">{side.nombre}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Stock ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <Field label="Stock diario por defecto" htmlFor="stockDiarioDefault"
              error={errors.stockDiarioDefault?.message}
              hint="A esto se resetea cada día a las 00:00">
              <Input id="stockDiarioDefault" type="number" min={0}
                {...register('stockDiarioDefault', { valueAsNumber: true })} />
            </Field>

            <Field label="Stock actual" htmlFor="stockActual"
              error={errors.stockActual?.message}
              hint="Lo disponible hoy. Decrementa con cada pedido.">
              <Input id="stockActual" type="number" min={0}
                {...register('stockActual', { valueAsNumber: true })} />
            </Field>
          </div>

          {/* ── Plato especial ─────────────────────────────────────── */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="especial" className="uppercase tracking-brand text-xs">
                  Plato especial
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {especial
                    ? 'Solo aparece en el menú los días seleccionados.'
                    : 'Aparece todos los días como plato regular.'}
                </p>
              </div>
              <Switch
                id="especial"
                checked={especial}
                onCheckedChange={(v) => {
                  setValue('especial', v, { shouldDirty: true });
                  if (!v) setValue('diasSemana', [], { shouldDirty: true });
                }}
              />
            </div>

            {especial && (
              <div className="flex flex-wrap gap-2 pl-1">
                {DIAS.map(({ value, label }) => {
                  const active = diasSemana.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-brand border transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-border hover:border-primary'
                      )}
                      onClick={() => {
                        const next = active
                          ? diasSemana.filter((d) => d !== value)
                          : [...diasSemana, value];
                        setValue('diasSemana', next, { shouldDirty: true });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {serverError && <p className="text-destructive text-xs">{serverError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
              {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear plato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function defaultValues(): FormData {
  return {
    nombre: '',
    descripcion: '',
    fotoUrl: '',
    categoryId: 0,
    menuSectionId: 0,
    sideType: 'NONE',
    allowedSideIds: [],
    stockDiarioDefault: 10,
    stockActual: 10,
    enabled: true,
    especial: false,
    diasSemana: [],
  };
}

function editingToForm(d: AdminDish): FormData {
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    fotoUrl: d.fotoUrl ?? '',
    categoryId: d.category.id,
    menuSectionId: d.menuSection.id,
    sideType: d.sideType ?? 'NONE',
    allowedSideIds: d.allowedSides.map((s) => s.id),
    stockDiarioDefault: d.stockDiarioDefault,
    stockActual: d.stockActual,
    enabled: d.enabled,
    especial: d.especial,
    diasSemana: d.diasSemana ?? [],
  };
}

function formToPayload(data: FormData, isEditing: boolean) {
  const realSideType: SideType | null = data.sideType === 'NONE' ? null : data.sideType;
  return {
    nombre: data.nombre,
    descripcion: data.descripcion || undefined,
    fotoUrl: data.fotoUrl || undefined,
    categoryId: data.categoryId,
    menuSectionId: data.menuSectionId,
    sideType: realSideType,
    allowedSideIds: realSideType ? data.allowedSideIds : [],
    stockDiarioDefault: data.stockDiarioDefault,
    stockActual: data.stockActual,
    especial: data.especial,
    diasSemana: data.especial ? data.diasSemana : [],
    ...(isEditing && { enabled: data.enabled }),
  };
}

function Field({
  label, htmlFor, error, hint, children,
}: {
  label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="uppercase tracking-brand text-xs">{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {!error && hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}

function RadioOption({ value, label }: { value: string; label: string }) {
  return (
    <Label
      htmlFor={`sideType-${value}`}
      className="flex items-center gap-3 p-2 rounded-md border border-border cursor-pointer hover:border-primary transition-colors has-[:checked]:border-primary has-[:checked]:bg-muted/50"
    >
      <RadioGroupItem id={`sideType-${value}`} value={value} />
      <span className="text-sm font-normal">{label}</span>
    </Label>
  );
}
