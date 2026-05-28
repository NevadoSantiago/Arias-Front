import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  createSide, updateSide,
  type AdminSide, type SideType,
} from '@/features/admin/services/adminApi';

const schema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  tipo: z.enum(['GUARNICION', 'SALSA']),
  enabled: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: AdminSide | null;
}

export function SideFormDialog({ open, onClose, editing }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', tipo: 'GUARNICION', enabled: true },
  });

  const tipo = watch('tipo');
  const enabled = watch('enabled');

  useEffect(() => {
    if (!open) return;
    if (editing) reset({ nombre: editing.nombre, tipo: editing.tipo, enabled: editing.enabled });
    else reset({ nombre: '', tipo: 'GUARNICION', enabled: true });
    setServerError(null);
  }, [editing, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        nombre: data.nombre,
        tipo: data.tipo,
        ...(isEditing && { enabled: data.enabled }),
      };
      if (isEditing && editing) return updateSide(editing.id, payload);
      return createSide(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSides'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEditing ? 'Editar acompañamiento' : 'Nuevo acompañamiento'}
          </DialogTitle>
          <DialogDescription>
            Guarniciones y salsas que el empleado puede elegir al pedir un plato.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => { setServerError(null); mutation.mutate(data); })}
          className="space-y-5"
          noValidate
        >
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
                  Disponible
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {enabled
                    ? 'Puede asociarse a platos y elegirse al pedir.'
                    : 'Oculto. No aparece en el modal de elección del empleado.'}
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
            <Input id="nombre" {...register('nombre')} autoFocus placeholder="Ej: Papas fritas" />
            {errors.nombre && <p className="text-destructive text-xs">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo" className="uppercase tracking-brand text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v: SideType) => setValue('tipo', v, { shouldValidate: true })}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GUARNICION">Guarnición</SelectItem>
                <SelectItem value="SALSA">Salsa</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && <p className="text-destructive text-xs">{errors.tipo.message}</p>}
            <p className="text-muted-foreground text-[11px]">
              Cada plato acepta acompañamientos de un solo tipo. Una milanesa lleva
              guarniciones, los fideos llevan salsas.
            </p>
          </div>

          {serverError && <p className="text-destructive text-xs">{serverError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
              {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
