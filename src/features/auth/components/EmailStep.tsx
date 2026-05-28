import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkEmail } from '../services/authApi';

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
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: initialEmail },
  });

  const onSubmit = async (data: FormData) => {
    const { requiresFirstLogin } = await checkEmail(data.email);
    if (requiresFirstLogin) {
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
          Ingresá con el email registrado por tu empresa.
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
          {isSubmitting ? 'Verificando…' : 'Continuar'}
        </Button>
      </form>
    </>
  );
}
