import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  createMenuSection,
  updateMenuSection,
  type AdminMenuSection,
} from '@/features/admin/services/adminApi';

const schema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  ordenDisplay: z.number().int().min(0, 'Mayor o igual a 0'),
  enabled: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: AdminMenuSection | null;
}

export function SectionFormDialog({ open, onClose, editing }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', ordenDisplay: 0, enabled: true },
  });

  const enabled = watch('enabled');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({ nombre: editing.nombre, ordenDisplay: editing.ordenDisplay, enabled: editing.enabled });
    } else {
      reset({ nombre: '', ordenDisplay: 0, enabled: true });
    }
    setServerError(null);
  }, [editing, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        nombre: data.nombre,
        ordenDisplay: data.ordenDisplay,
        // En create el backend ignora el campo (default true). En update lo aplica.
        ...(isEditing && { enabled: data.enabled }),
      };
      if (isEditing && editing) {
        return updateMenuSection(editing.id, payload);
      }
      return createMenuSection(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMenuSections'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEditing ? 'Editar sección' : 'Nueva sección'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modificá el nombre, el orden o la disponibilidad.'
              : 'Las secciones agrupan los platos en el menú del empleado (Carnes, Pastas, etc.).'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => { setServerError(null); mutation.mutate(data); })} className="space-y-5" noValidate>
          {/* Switch de disponibilidad — solo al editar */}
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
                    ? 'Aparece como filter pill en el menú del empleado.'
                    : 'Oculta. Los platos de esta sección no se ven al filtrar.'}
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
              Más bajo = aparece primero en el listado del empleado.
            </p>
          </div>

          {serverError && <p className="text-destructive text-xs">{serverError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
              {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear sección'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
