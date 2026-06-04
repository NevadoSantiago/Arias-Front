import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitQuote } from '../services/landingApi';
import { buildWhatsAppUrl } from '../landingConfig';

const schema = z.object({
  nombre: z.string().min(2, 'Ingresá tu nombre'),
  empresa: z.string().min(2, 'Ingresá el nombre de tu empresa'),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional().or(z.literal('')),
  // String opcional; si viene, tiene que ser un entero positivo. Lo parseamos
  // a número recién en el submit (evita el quilombo de coerce con "" → 0).
  empleados: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'Ingresá un número válido')
    .refine((v) => !v || Number(v) >= 1, 'Mínimo 1'),
  mensaje: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

export function QuoteForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await submitQuote({
        nombre: data.nombre,
        empresa: data.empresa,
        email: data.email,
        telefono: data.telefono || undefined,
        empleados: data.empleados ? Number(data.empleados) : undefined,
        mensaje: data.mensaje || undefined,
      });
      setSent(true);
    } catch {
      setServerError(
        'No pudimos enviar tu consulta. Probá de nuevo o escribinos directo por WhatsApp.',
      );
    }
  };

  if (sent) {
    return (
      <div className="text-center py-8">
        <p className="font-display text-2xl text-foreground mb-2">¡Gracias! 🎉</p>
        <p className="text-muted-foreground text-sm">
          Recibimos tu consulta. El equipo de Arias te va a contactar a la brevedad.
        </p>
      </div>
    );
  }

  // Evita el submit accidental al apretar Enter en un input de una línea
  // (comportamiento nativo del browser). El textarea sí conserva el Enter
  // para saltos de línea; el envío queda solo en manos del botón.
  const blockEnterSubmit = (e: KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={blockEnterSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nombre" className="uppercase tracking-brand text-xs">Nombre</Label>
          <Input id="nombre" autoComplete="name" {...register('nombre')} />
          {errors.nombre && <p className="text-destructive text-xs">{errors.nombre.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="empresa" className="uppercase tracking-brand text-xs">Empresa</Label>
          <Input id="empresa" autoComplete="organization" {...register('empresa')} />
          {errors.empresa && <p className="text-destructive text-xs">{errors.empresa.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="uppercase tracking-brand text-xs">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono" className="uppercase tracking-brand text-xs">
            Teléfono <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
          </Label>
          <Input id="telefono" type="tel" autoComplete="tel" {...register('telefono')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="empleados" className="uppercase tracking-brand text-xs">
          Cantidad de empleados <span className="text-muted-foreground/70 normal-case tracking-normal">(aprox.)</span>
        </Label>
        <Input id="empleados" type="number" min={1} className="max-w-[160px]" {...register('empleados')} />
        {errors.empleados && <p className="text-destructive text-xs">{errors.empleados.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mensaje" className="uppercase tracking-brand text-xs">
          Mensaje <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
        </Label>
        <textarea
          id="mensaje"
          rows={3}
          {...register('mensaje')}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Contanos qué necesitás para tu equipo…"
        />
        {errors.mensaje && <p className="text-destructive text-xs">{errors.mensaje.message}</p>}
      </div>

      {serverError && (
        <div className="text-xs text-destructive space-y-1">
          <p>{serverError}</p>
          <a
            href={buildWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Escribinos por WhatsApp →
          </a>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full uppercase tracking-brand font-medium"
      >
        {isSubmitting ? 'Enviando…' : 'Pedí tu cotización'}
      </Button>
    </form>
  );
}
