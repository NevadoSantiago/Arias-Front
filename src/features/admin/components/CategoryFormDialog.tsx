import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  createCategory,
  updateCategory,
  listCompanies,
  type AdminCategoryFull,
} from '@/features/admin/services/adminApi';

const NO_PARENT = 'none';

const schema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  parentId: z.string(), // 'none' o el id como string (Select solo acepta strings)
  ordenDisplay: z.number().int().min(0, 'Mayor o igual a 0'),
  enabled: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: AdminCategoryFull | null;
  allCategories: AdminCategoryFull[];
}

export function CategoryFormDialog({ open, onClose, editing, allCategories }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);
  const [companyPrices, setCompanyPrices] = useState<Record<number, number>>({});

  const { data: companies } = useQuery({
    queryKey: ['adminCompanies'],
    queryFn: listCompanies,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', parentId: NO_PARENT, ordenDisplay: 0, enabled: true },
  });

  const enabled = watch('enabled');
  const parentId = watch('parentId');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        nombre: editing.nombre,
        parentId: editing.parentId != null ? String(editing.parentId) : NO_PARENT,
        ordenDisplay: editing.ordenDisplay,
        enabled: editing.enabled,
      });
    } else {
      reset({ nombre: '', parentId: NO_PARENT, ordenDisplay: 0, enabled: true });
    }
    setServerError(null);
  }, [editing, open, reset]);

  // Sincronizar precios cuando llegan las empresas o cambia el editing
  useEffect(() => {
    if (!open || !companies) return;
    const initial: Record<number, number> = {};
    for (const co of companies) {
      initial[co.id] = editing?.companyPrices?.[co.id] ?? 0;
    }
    setCompanyPrices(initial);
  }, [open, companies, editing]);

  // Excluimos la categoría que estamos editando (no puede ser padre de sí misma)
  const parentOptions = allCategories.filter((c) => c.id !== editing?.id);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        nombre: data.nombre,
        parentId: data.parentId === NO_PARENT ? null : Number(data.parentId),
        ordenDisplay: data.ordenDisplay,
        ...(isEditing && { enabled: data.enabled }),
        companyPrices,
      };
      if (isEditing && editing) {
        return updateCategory(editing.id, payload);
      }
      return createCategory(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEditing ? 'Editar categoría' : 'Nueva categoría'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modificá nombre, padre, orden o disponibilidad.'
              : 'Las categorías definen el nivel de acceso del empleado (Premium, Básico, etc.).'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => { setServerError(null); mutation.mutate(data); })}
          className="space-y-5"
          noValidate
        >
          {isEditing && (
            <div className={cn(
              'flex items-center justify-between gap-4 p-4 rounded-md border',
              enabled
                ? 'border-success/30 bg-success/5'
                : 'border-destructive/30 bg-destructive/5',
            )}>
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="uppercase tracking-brand text-xs">
                  Disponible
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {enabled
                    ? 'Aparece en los dropdowns de empresa y empleados.'
                    : 'Oculta. Los platos asignados a esta categoría quedan inaccesibles.'}
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={(v) => setValue('enabled', v, { shouldDirty: true })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="uppercase tracking-brand text-xs">Nombre</Label>
            <Input id="nombre" {...register('nombre')} autoFocus />
            {errors.nombre && <p className="text-destructive text-xs">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="parentId" className="uppercase tracking-brand text-xs">Padre (opcional)</Label>
            <Select value={parentId} onValueChange={(v) => setValue('parentId', v, { shouldDirty: true })}>
              <SelectTrigger id="parentId">
                <SelectValue placeholder="Sin padre (categoría raíz)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>Sin padre (raíz)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px]">
              Un empleado con categoría X ve sus platos + los de las categorías hijas.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ordenDisplay" className="uppercase tracking-brand text-xs">Orden</Label>
            <Input
              id="ordenDisplay"
              type="number"
              min={0}
              {...register('ordenDisplay', { valueAsNumber: true })}
              className="max-w-[150px]"
            />
            {errors.ordenDisplay && <p className="text-destructive text-xs">{errors.ordenDisplay.message}</p>}
            <p className="text-muted-foreground text-[11px]">
              Más bajo = aparece primero en los dropdowns.
            </p>
          </div>

          {/* Precios por empresa */}
          {companies && companies.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-[10px] uppercase tracking-brand text-primary font-bold">
                Precios por empresa
              </p>
              <p className="text-[11px] text-muted-foreground">
                Valor acordado para esta categoría con cada empresa. Pesos sin decimales.
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {companies.map((co) => (
                  <div key={co.id} className="flex items-center gap-3">
                    <Label htmlFor={`price-co-${co.id}`} className="text-xs flex-1 min-w-0 truncate">
                      {co.nombre}
                    </Label>
                    <div className="relative w-[140px] shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        id={`price-co-${co.id}`}
                        type="number"
                        min={0}
                        step={1}
                        className="pl-7 h-9"
                        value={companyPrices[co.id] ?? 0}
                        onChange={(e) =>
                          setCompanyPrices((prev) => ({
                            ...prev,
                            [co.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {serverError && <p className="text-destructive text-xs">{serverError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
              {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
