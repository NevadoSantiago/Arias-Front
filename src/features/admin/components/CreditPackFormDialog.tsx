import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
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
import type { PackType } from '@/features/credits/types';

const PACK_TYPES: { value: PackType; label: string; help: string }[] = [
  {
    value: 'INDIVIDUAL',
    label: 'Individual',
    help: 'Su precio por almuerzo es el que se cobra al pagar un pedido directo. Solo puede haber uno.',
  },
  {
    value: 'SUGERIDO',
    label: 'Sugerido',
    help: 'Es el paquete que se sugiere a quien compra almuerzos sueltos. Solo puede haber uno.',
  },
  { value: 'OTRO', label: 'Otro', help: 'Sin comportamiento especial.' },
];

const schema = z.object({
  packType: z.enum(['INDIVIDUAL', 'SUGERIDO', 'OTRO']),
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
  /** Tipos de paquete que ya existen (vivos): INDIVIDUAL y SUGERIDO admiten uno solo. */
  existingTypes?: PackType[];
}

/**
 * Alta/edición de paquetes de almuerzos (spec `credit-pack-purchase`
 * del backend, contraparte de administración). El formulario interno se
 * remonta con `key` cada vez que cambia el paquete en edición (en vez de
 * sincronizar estado con un `useEffect`), así `useForm` arranca siempre con
 * los `defaultValues` correctos.
 */
export function CreditPackFormDialog({ open, onClose, editing, existingTypes = [] }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <CreditPackForm
            key={editing?.id ?? 'new'}
            editing={editing ?? null}
            existingTypes={existingTypes}
            onClose={onClose}
          />
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
  existingTypes,
  onClose,
}: {
  editing: AdminCreditPack | null;
  existingTypes: PackType[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          packType: editing.packType,
          nombre: editing.nombre,
          creditAmount: editing.creditAmount,
          priceArs: editing.priceCents / 100,
          discountPercent: editing.discountPercent,
          ordenDisplay: editing.ordenDisplay,
        }
      : {
          packType: firstFreeType(existingTypes),
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
        packType: data.packType,
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
      setServerError(describeError(err));
    },
  });

  const watchedType = useWatch({ control, name: 'packType' });
  const selectedType =
    PACK_TYPES.find((t) => t.value === watchedType) ?? PACK_TYPES[2];

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
          label="Tipo"
          htmlFor="packType"
          error={errors.packType?.message}
          hint={isEditing ? 'No se puede modificar' : selectedType.help}
        >
          <select
            id="packType"
            {...register('packType')}
            disabled={isEditing}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {PACK_TYPES.map((t) => {
              const taken = !isEditing && t.value !== 'OTRO' && existingTypes.includes(t.value);
              return (
                <option key={t.value} value={t.value} disabled={taken}>
                  {taken ? `${t.label} · ya existe` : t.label}
                </option>
              );
            })}
          </select>
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

/** Primer tipo libre (INDIVIDUAL y SUGERIDO admiten uno solo); OTRO siempre está disponible. */
function firstFreeType(existing: PackType[]): PackType {
  return PACK_TYPES.find((t) => t.value === 'OTRO' || !existing.includes(t.value))!.value;
}

/** Mensaje en español para el error del backend (problem+json). */
function describeError(err: unknown): string {
  const e = (typeof err === 'object' && err !== null ? err : {}) as {
    response?: { status?: number; data?: { type?: string; detail?: string } };
  };
  const type = e.response?.data?.type ?? '';
  if (type.includes('credit-pack-type-duplicate')) {
    return 'Ya existe un paquete de ese tipo. Editá el existente o elegí otro tipo.';
  }
  if (type.includes('credit-pack-code-duplicate')) {
    return 'Ya existe un paquete con ese código. Probá con otro nombre.';
  }
  return e.response?.data?.detail ?? 'Ocurrió un error al guardar';
}
