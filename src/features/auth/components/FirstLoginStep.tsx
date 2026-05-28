import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthActions } from '../hooks/useAuthActions';

const schema = z
  .object({
    firstName: z
      .string()
      .min(2, 'El nombre tiene que tener al menos 2 caracteres')
      .max(50),
    lastName: z.string().max(50).optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
      .max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });
type FormData = z.infer<typeof schema>;

interface Props {
  email: string;
  onBack: () => void;
}

export function FirstLoginStep({ email, onBack }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { performFirstLogin } = useAuthActions();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await performFirstLogin({
        email,
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        password: data.password,
      });
      // performFirstLogin se encarga de navegar
    } catch {
      setServerError('No pudimos crear tu cuenta. Probá de nuevo.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary uppercase tracking-brand mb-6 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        <span>{email}</span>
      </button>

      <div className="mb-8">
        <h2 className="font-display text-foreground text-3xl font-bold mb-2">
          ¡Bienvenido a Arias!
        </h2>
        <p className="text-muted-foreground text-sm">
          Es tu primer ingreso. Completá tus datos para crear tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="uppercase tracking-brand text-xs">
              Nombre
            </Label>
            <Input
              id="firstName"
              type="text"
              autoComplete="given-name"
              autoFocus
              aria-invalid={!!errors.firstName}
              {...register('firstName')}
            />
            {errors.firstName && (
              <p className="text-destructive text-xs mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="uppercase tracking-brand text-xs">
              Apellido <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
            </Label>
            <Input
              id="lastName"
              type="text"
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
              {...register('lastName')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="uppercase tracking-brand text-xs">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
          ) : (
            <p className="text-muted-foreground text-xs mt-1">Mínimo 8 caracteres</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="uppercase tracking-brand text-xs">
            Confirmar contraseña
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-destructive text-xs">{serverError}</p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full uppercase tracking-brand font-medium"
          size="lg"
        >
          {isSubmitting ? 'Creando tu cuenta…' : 'Crear cuenta e ingresar'}
        </Button>
      </form>
    </>
  );
}
