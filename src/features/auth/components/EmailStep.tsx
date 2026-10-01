import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkEmail } from '../services/authApi';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { GoogleSignInSection } from './GoogleSignInSection';
import { GoogleWelcomeScreen } from './GoogleWelcomeScreen';

const schema = z.object({
  email: z.string().min(1, 'Ingresá tu email').email('El formato del email no es válido'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  initialEmail?: string;
  onFirstLogin: (email: string) => void;
  onPassword: (email: string) => void;
}

export function EmailStep({ initialEmail = '', onFirstLogin, onPassword }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail },
  });

  const google = useGoogleSignIn();
  const excludedEmail = google.problem?.kind === 'excluded' ? google.problem.email : undefined;

  // Una cuenta de empresa que tocó Google sigue por email: le dejamos el suyo cargado.
  useEffect(() => {
    if (excludedEmail) setValue('email', excludedEmail);
  }, [excludedEmail, setValue]);

  const onSubmit = async (data: FormData) => {
    const { requiresFirstLogin } = await checkEmail(data.email);
    if (requiresFirstLogin) {
      onFirstLogin(data.email);
    } else {
      onPassword(data.email);
    }
  };

  if (google.welcome) {
    return <GoogleWelcomeScreen google={google} />;
  }

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

      <GoogleSignInSection google={google} mode="login" dividerLabel="O ingresá con tu email" />

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
          {isSubmitting ? 'Verificando…' : 'Continuar'}
        </Button>
      </form>

      <div className="relative mt-6 mb-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground uppercase tracking-brand">¿No tenés cuenta?</span>
        </div>
      </div>

      <Button asChild size="lg" variant="outline" className="w-full uppercase tracking-brand font-medium">
        <Link to="/register">Creá tu cuenta</Link>
      </Button>
    </>
  );
}
