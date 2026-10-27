import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkEmail, type AccountStatus } from '../services/authApi';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { GoogleSignInSection } from './GoogleSignInSection';

const schema = z.object({
  email: z.string().min(1, 'Ingresá tu email').email('El formato del email no es válido'),
});
type FormData = z.infer<typeof schema>;

/** Avisos que se muestran en el paso de email en vez de avanzar. */
export type EmailNotice = Extract<AccountStatus, 'NOT_FOUND' | 'GOOGLE'>;

interface Props {
  initialEmail?: string;
  /** Aviso inicial (deep link `?email=` que ya se resolvió). */
  initialNotice?: EmailNotice;
  onFirstLogin: (email: string) => void;
  onPassword: (email: string) => void;
}

export function EmailStep({ initialEmail = '', initialNotice, onFirstLogin, onPassword }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail },
  });

  const [notice, setNotice] = useState<EmailNotice | null>(initialNotice ?? null);
  const email = useWatch({ control, name: 'email' });
  // El link de registro lleva el email escrito solo si es válido.
  const registerHref = schema.safeParse({ email }).success
    ? `/register?email=${encodeURIComponent(email)}`
    : '/register';

  const google = useGoogleSignIn();
  const excludedEmail = google.problem?.kind === 'excluded' ? google.problem.email : undefined;

  // Una cuenta de empresa que tocó Google sigue por email: le dejamos el suyo cargado.
  useEffect(() => {
    if (excludedEmail) setValue('email', excludedEmail);
  }, [excludedEmail, setValue]);

  const onSubmit = async (data: FormData) => {
    const { requiresFirstLogin, status } = await checkEmail(data.email);
    if (status === 'NOT_FOUND' || status === 'GOOGLE') {
      setNotice(status);
    } else if (status === 'FIRST_LOGIN' || (!status && requiresFirstLogin)) {
      onFirstLogin(data.email);
    } else {
      onPassword(data.email);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="font-display text-foreground text-3xl font-bold mb-2">
          Iniciá sesión
        </h2>
        <p className="text-muted-foreground text-sm">
          Ingresá con Google o con tu email.
        </p>
      </div>

      <GoogleSignInSection
        google={google}
        mode="login"
        dividerLabel="O ingresá con tu email"
        highlight={notice === 'GOOGLE'}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" className="uppercase tracking-brand text-xs">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            aria-invalid={!!errors.email}
            {...register('email', { onChange: () => setNotice(null) })}
          />
          {errors.email && (
            <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        {notice === 'NOT_FOUND' ? (
          <div role="status" className="rounded-md border border-border bg-muted p-4 text-sm">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold text-foreground">No encontramos una cuenta con ese email</p>
                <p className="mt-1 text-muted-foreground">Si es tu primera vez en Arias, creá tu cuenta.</p>
              </div>
            </div>
            <Button
              asChild
              size="lg"
              className="mt-4 h-11 w-full bg-primary-deep uppercase tracking-brand font-medium"
            >
              <Link to={registerHref}>Crear cuenta</Link>
            </Button>
          </div>
        ) : (
          <>
            {notice === 'GOOGLE' && (
              <div role="status" className="rounded-md border border-border bg-muted p-4 text-sm">
                <div className="flex gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Tu cuenta entra con Google</p>
                    <p className="mt-1 text-muted-foreground">
                      La creaste con Google, así que no tiene contraseña. Tocá el botón Continuar con Google de
                      arriba y elegí este email.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full uppercase tracking-brand font-medium"
              size="lg"
            >
              {isSubmitting ? 'Verificando…' : 'Continuar'}
            </Button>
          </>
        )}
      </form>

      {notice !== 'NOT_FOUND' && (
        <>
          <div className="relative mt-6 mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground uppercase tracking-brand">¿No tenés cuenta?</span>
            </div>
          </div>

          <Button asChild size="lg" variant="outline" className="w-full uppercase tracking-brand font-medium">
            <Link to={registerHref}>Creá tu cuenta</Link>
          </Button>
        </>
      )}
    </>
  );
}
