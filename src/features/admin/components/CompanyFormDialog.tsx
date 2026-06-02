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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createCompany,
  updateCompany,
  listCategories,
  listCategoriesAdmin,
  type Company,
} from '@/features/admin/services/adminApi';

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  cuit: z.string().regex(/^\d{2}-\d{8}-\d$/, 'Formato: XX-XXXXXXXX-X'),
  calle: z.string().min(1, 'Requerido').max(200),
  altura: z.string().min(1, 'Requerido').max(20),
  piso: z.string().max(20).optional().or(z.literal('')),
  horaEntrega: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  categoriaDefaultId: z.number().int().positive('Elegí una categoría'),
  adminEmail: z.string().email('Email inválido').max(255),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Si se pasa, es modo edición. Si null/undefined, es alta. */
  editing?: Company | null;
}

export function CompanyFormDialog({ open, onClose, editing }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;

  // Para el dropdown "Categoría por defecto" — solo las habilitadas
  const { data: activeCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    enabled: open,
  });

  // Para los inputs de precio — TODAS (incluso deshabilitadas)
  const { data: categories } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: listCategoriesAdmin,
    enabled: open,
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const [categoryPrices, setCategoryPrices] = useState<Record<number, number>>({});

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      cuit: '',
      calle: '',
      altura: '',
      piso: '',
      horaEntrega: '12:30',
      categoriaDefaultId: 0,
      adminEmail: '',
    },
  });

  const selectedCategoryId = watch('categoriaDefaultId');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        nombre: editing.nombre,
        cuit: editing.cuit,
        calle: editing.calle,
        altura: editing.altura,
        piso: editing.piso ?? '',
        horaEntrega: editing.horaEntrega,
        categoriaDefaultId: editing.categoriaDefaultId,
        // Pre-llenamos con el email actual del CompanyAdmin
        adminEmail: editing.adminEmail ?? '',
      });
    } else {
      reset({
        nombre: '',
        cuit: '',
        calle: '',
        altura: '',
        piso: '',
        horaEntrega: '12:30',
        categoriaDefaultId: 0,
        adminEmail: '',
      });
    }
    setServerError(null);
  }, [editing, open, reset]);

  // Sincronizar el state de precios cuando llegan las categorías o cambia el editing.
  useEffect(() => {
    if (!open || !categories) return;
    const initial: Record<number, number> = {};
    for (const cat of categories) {
      initial[cat.id] = editing?.categoryPrices?.[cat.id] ?? 0;
    }
    setCategoryPrices(initial);
  }, [open, categories, editing]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        nombre: data.nombre,
        cuit: data.cuit,
        calle: data.calle,
        altura: data.altura,
        piso: data.piso || undefined,
        horaEntrega: data.horaEntrega,
        categoriaDefaultId: data.categoriaDefaultId,
        adminEmail: data.adminEmail,
        categoryPrices,
      };
      if (isEditing && editing) {
        return updateCompany(editing.id, payload);
      }
      return createCompany(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCompanies'] });
      onClose();
    },
    onError: (err: unknown) => {
      const message = extractApiError(err) ?? 'Ocurrió un error al guardar';
      setServerError(message);
    },
  });

  const onSubmit = handleSubmit((data) => {
    setServerError(null);
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEditing ? 'Editar empresa' : 'Nueva empresa'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditing
              ? 'Modificá los datos de la empresa.'
              : 'Al crear la empresa, también se crea el primer admin (cuenta sin password — completa el primer login).'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {/* Nombre */}
          <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register('nombre')} autoFocus />
          </Field>

          {/* CUIT */}
          <Field label="CUIT" htmlFor="cuit" error={errors.cuit?.message} hint="Formato: XX-XXXXXXXX-X">
            <Input id="cuit" {...register('cuit')} placeholder="30-12345678-9" />
          </Field>

          {/* Dirección */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="Calle" htmlFor="calle" error={errors.calle?.message}>
                <Input id="calle" {...register('calle')} />
              </Field>
            </div>
            <Field label="Altura" htmlFor="altura" error={errors.altura?.message}>
              <Input id="altura" {...register('altura')} />
            </Field>
          </div>

          <Field label="Piso" htmlFor="piso" hint="Opcional">
            <Input id="piso" {...register('piso')} className="max-w-[150px]" />
          </Field>

          {/* Hora de entrega + Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Hora de entrega" htmlFor="horaEntrega" error={errors.horaEntrega?.message}>
              <Input id="horaEntrega" type="time" {...register('horaEntrega')} step={60} />
            </Field>
            <Field label="Categoría por defecto" htmlFor="categoriaDefaultId" error={errors.categoriaDefaultId?.message}>
              <Select
                value={selectedCategoryId ? String(selectedCategoryId) : ''}
                onValueChange={(v) => setValue('categoriaDefaultId', Number(v), { shouldValidate: true })}
              >
                <SelectTrigger id="categoriaDefaultId">
                  <SelectValue placeholder="Elegí una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories?.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Precios por categoría */}
          {categories && categories.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] uppercase tracking-brand text-primary font-bold mb-3">
                Precios por categoría
              </p>
              <p className="text-[11px] text-muted-foreground mb-3">
                Valor acordado para esta empresa por cada categoría. Pesos sin decimales.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <Label htmlFor={`price-${cat.id}`} className="text-xs">
                      {cat.nombre}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        id={`price-${cat.id}`}
                        type="number"
                        min={0}
                        step={1}
                        className="pl-7"
                        value={categoryPrices[cat.id] ?? 0}
                        onChange={(e) =>
                          setCategoryPrices((prev) => ({
                            ...prev,
                            [cat.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin email — visible siempre. En create lo crea, en edit actualiza al user existente */}
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] uppercase tracking-brand text-primary font-bold mb-3">
              {isEditing ? 'Administrador de la empresa' : 'Administrador inicial de la empresa'}
            </p>
            <Field
              label="Email del administrador"
              htmlFor="adminEmail"
              error={errors.adminEmail?.message}
              hint={isEditing
                ? 'Si lo cambiás, el usuario administrador va a tener que loguearse con el nuevo email.'
                : 'Recibirá el primer ingreso para setear su nombre y password.'
              }
            >
              <Input id="adminEmail" type="email" {...register('adminEmail')} placeholder="admin@empresa.com" />
            </Field>
          </div>

          {serverError && (
            <p className="text-destructive text-xs">{serverError}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="uppercase tracking-brand">
              {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
