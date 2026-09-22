import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthActions } from '../hooks/useAuthActions';

const schema = z.object({
  phone: z.string().min(1, 'Ingresá tu teléfono').max(30),
  nickname: z
    .string()
    .min(2, 'El apodo tiene que tener al menos 2 caracteres')
    .max(50),
});
type FormData = z.infer<typeof schema>;

/**
 * Completa teléfono/apodo tras un alta con Google (Google no provee esos
 * datos). Requiere sesión ya establecida — {@link useAuthActions.performCompleteProfile}
 * navega al home del rol al terminar.
 */
export function CompleteProfileForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { performCompleteProfile } = useAuthActions();

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
      await performCompleteProfile(data);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Ocurrió un error. Probá de nuevo.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="phone" className="uppercase tracking-brand text-xs">
          Teléfono
        </Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          autoFocus
          placeholder="+54 9 11 1234-5678"
          aria-invalid={!!errors.phone}
          {...register('phone')}
        />
        {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nickname" className="uppercase tracking-brand text-xs">
          ¿Cómo querés que te llamemos?
        </Label>
        <Input
          id="nickname"
          type="text"
          autoComplete="nickname"
          placeholder="Va en tu ticket de cocina"
          aria-invalid={!!errors.nickname}
          {...register('nickname')}
        />
        {errors.nickname && <p className="text-destructive text-xs mt-1">{errors.nickname.message}</p>}
      </div>

      {serverError && <p className="text-destructive text-xs">{serverError}</p>}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full uppercase tracking-brand font-medium"
        size="lg"
      >
        {isSubmitting ? 'Guardando…' : 'Continuar'}
      </Button>
    </form>
  );
}
