import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/features/auth/services/authApi';

const schema = z.object({
  email: z.string().min(1, 'Ingresá tu email').email('El formato del email no es válido'),
});
type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get('email') ?? '' },
  });

  const onSubmit = async (data: FormData) => {
    await forgotPassword(data.email);
    setSent(true);
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
            {sent ? (
              <>
                <div className="mb-8">
                  <h2 className="font-display text-foreground text-3xl font-bold mb-2">
                    Revisá tu email
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Si el email está registrado, te enviamos las instrucciones.
                  </p>
                </div>

                <Link
                  to="/login"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Volver al inicio de sesión
                </Link>
              </>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="font-display text-foreground text-3xl font-bold mb-2">
                    Restablecer contraseña
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Ingresá tu email y te enviamos las instrucciones.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="uppercase tracking-brand text-xs">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@empresa.com"
                      autoFocus
                      aria-invalid={!!errors.email}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full uppercase tracking-brand font-medium"
                    size="lg"
                  >
                    {isSubmitting ? 'Enviando…' : 'Enviar instrucciones'}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    to="/login"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
