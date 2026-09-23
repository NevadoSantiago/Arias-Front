import { useState } from 'react';
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
import {
  createCreditPack,
  updateCreditPack,
  type AdminCreditPack,
} from '@/features/admin/services/adminApi';

const schema = z.object({
  code: z.string().min(2, 'Mínimo 2 caracteres').max(20),
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  creditAmount: z.number().int().positive('Debe ser mayor a 0'),
  priceArs: z.number().positive('Debe ser mayor a 0'),
  discountPercent: z.number().int().min(0).max(100),
  ordenDisplay: z.number().int().min(0),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Si se pasa, es modo edición. Si null/undefined, es alta. */
  editing?: AdminCreditPack | null;
}

/**
 * Alta/edición de paquetes de almuerzos (spec `credit-pack-purchase`
 * del backend, contraparte de administración). El formulario interno se
 * remonta con `key` cada vez que cambia el paquete en edición (en vez de
 * sincronizar estado con un `useEffect`), así `useForm` arranca siempre con
 * los `defaultValues` correctos.
 */
export function CreditPackFormDialog({ open, onClose, editing }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <CreditPackForm key={editing?.id ?? 'new'} editing={editing ?? null} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * `priceArs` es un campo de UI que se convierte a `priceCents` (el valor
 * autoritativo) recién al enviar — el descuento nunca afecta ese cálculo,
 * es solo presentacional.
 */
function CreditPackForm({
  editing,
  onClose,
}: {
  editing: AdminCreditPack | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          code: editing.code,
          nombre: editing.nombre,
          creditAmount: editing.creditAmount,
          priceArs: editing.priceCents / 100,
          discountPercent: editing.discountPercent,
          ordenDisplay: editing.ordenDisplay,
        }
      : {
          code: '',
          nombre: '',
          creditAmount: 1,
          priceArs: 0,
          discountPercent: 0,
          ordenDisplay: 0,
        },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const priceCents = Math.round(data.priceArs * 100);
      if (isEditing && editing) {
        return updateCreditPack(editing.id, {
          nombre: data.nombre,
          creditAmount: data.creditAmount,
          priceCents,
          discountPercent: data.discountPercent,
          ordenDisplay: data.ordenDisplay,
          enabled: editing.enabled,
        });
      }
      return createCreditPack({
        code: data.code,
        nombre: data.nombre,
        creditAmount: data.creditAmount,
        priceCents,
        discountPercent: data.discountPercent,
        ordenDisplay: data.ordenDisplay,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCreditPacks'] });
      onClose();
    },
    onError: (err: unknown) => {
      setServerError(extractApiError(err) ?? 'Ocurrió un error al guardar');
    },
  });

  const onSubmit = handleSubmit((data) => {
    setServerError(null);
    mutation.mutate(data);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">
          {isEditing ? 'Editar paquete' : 'Nuevo paquete de almuerzos'}
        </DialogTitle>
        <DialogDescription className="text-sm">
          El precio es el valor cobrado. El descuento es solo informativo para el cliente.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field
          label="Código"
          htmlFor="code"
          error={errors.code?.message}
          hint={isEditing ? 'No se puede modificar' : undefined}
        >
          <Input id="code" {...register('code')} disabled={isEditing} autoFocus={!isEditing} />
        </Field>

        <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
          <Input id="nombre" {...register('nombre')} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Almuerzos" htmlFor="creditAmount" error={errors.creditAmount?.message}>
            <Input id="creditAmount" type="number" min={1} step={1} {...register('creditAmount', { valueAsNumber: true })} />
          </Field>
          <Field label="Precio (ARS)" htmlFor="priceArs" error={errors.priceArs?.message}>
            <Input id="priceArs" type="number" min={0} step={1} {...register('priceArs', { valueAsNumber: true })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Descuento (%)"
            htmlFor="discountPercent"
            error={errors.discountPercent?.message}
            hint="Solo informativo — no afecta el precio cobrado"
          >
            <Input id="discountPercent" type="number" min={0} max={100} step={1} {...register('discountPercent', { valueAsNumber: true })} />
          </Field>
          <Field label="Orden" htmlFor="ordenDisplay" error={errors.ordenDisplay?.message}>
            <Input id="ordenDisplay" type="number" min={0} step={1} {...register('ordenDisplay', { valueAsNumber: true })} />
          </Field>
        </div>

        {serverError && <p className="text-destructive text-xs">{serverError}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
            {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear paquete'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="uppercase tracking-brand text-xs">
        {label}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {!error && hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}

/** Extrae el detail de un problem+json del backend */
function extractApiError(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail ?? null;
}
