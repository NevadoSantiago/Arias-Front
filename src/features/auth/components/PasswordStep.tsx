import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { InvalidCredentialsError } from '../services/authApi';
import { useAuthActions } from '../hooks/useAuthActions';

const schema = z.object({
  password: z.string().min(1, 'Ingresá tu contraseña'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  email: string;
  onBack: () => void;
}

export function PasswordStep({ email, onBack }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { performLogin } = useAuthActions();

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
      await performLogin({ email, password: data.password });
      // performLogin se encarga de navegar
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        setServerError(err.message);
      } else {
        setServerError('Ocurrió un error. Probá de nuevo.');
      }
    }
  };

  return (
    <>
      {/* Chip de email con back action */}
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
          Bienvenido de vuelta
        </h2>
        <p className="text-muted-foreground text-sm">
          Ingresá tu contraseña para continuar.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password" className="uppercase tracking-brand text-xs">
            Contraseña
          </Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!errors.password || !!serverError}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
          )}
          {serverError && (
            <p className="text-destructive text-xs mt-1">{serverError}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full uppercase tracking-brand font-medium"
          size="lg"
        >
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link
          to={`/forgot-password?email=${encodeURIComponent(email)}`}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </>
  );
}
