import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/features/auth/services/authApi';

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await resetPassword(token, data.password);
      toast.success('Contraseña actualizada');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch {
      setServerError('El link expiró o ya fue utilizado. Solicitá uno nuevo.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="text-center pt-8 lg:pt-12 pb-2 lg:pb-4">
        <h1 className="font-display text-primary text-6xl lg:text-7xl font-bold leading-none mb-2">
          ARIAS
        </h1>
        <p className="font-sans text-primary text-sm tracking-brand uppercase font-medium">
          Bodegón &middot; Parrilla
        </p>
        <p className="font-sans text-xs tracking-brand uppercase text-muted-foreground mt-2">
          Familia Mazzariello &middot; Desde 2015
        </p>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
            <div className="mb-8">
              <h2 className="font-display text-foreground text-3xl font-bold mb-2">
                Nueva contraseña
              </h2>
              <p className="text-muted-foreground text-sm">
                Elegí una contraseña nueva para tu cuenta.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password" className="uppercase tracking-brand text-xs">
                  Contraseña
                </Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  autoFocus
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="uppercase tracking-brand text-xs">
                  Confirmar contraseña
                </Label>
                <PasswordInput
                  id="confirmPassword"
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
                {isSubmitting ? 'Actualizando…' : 'Restablecer contraseña'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Solicitar nuevo link
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
