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
import { createEmployee } from '@/features/companyAdmin/services/companyAdminApi';

const schema = z.object({
  email: z.string().email('Email inválido').max(255),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EmployeeFormDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ email: '' });
    setServerError(null);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyEmployees'] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nuevo empleado</DialogTitle>
          <DialogDescription>
            Cargá el email del empleado. El va a completar sus datos (nombre, apellido,
            contraseña) la primera vez que ingrese.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => { setServerError(null); mutation.mutate(data); })}
          className="space-y-5"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="uppercase tracking-brand text-xs">Email del empleado</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              autoFocus
              placeholder="ej: maria@empresa.com"
            />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          {serverError && <p className="text-destructive text-xs">{serverError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
              {isSubmitting ? 'Cargando…' : 'Agregar empleado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
