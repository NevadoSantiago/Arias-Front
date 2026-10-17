import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthActions } from '../hooks/useAuthActions';
import { buildE164, phoneFields, refinePhone } from '../lib/phone';
import { DEFAULT_COUNTRY } from '../lib/countries';
import { PhoneField } from './PhoneField';

const schema = z.object({
  ...phoneFields,
  nickname: z
    .string()
    .min(2, 'El apodo tiene que tener al menos 2 caracteres')
    .max(50),
}).superRefine(refinePhone);
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phoneCountry: DEFAULT_COUNTRY },
  });
  const phoneCountry = useWatch({ control, name: 'phoneCountry' });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const phone = buildE164(data.phoneCountry, data.phoneNumber);
      // The schema already rejected invalid numbers, so this is always ok.
      await performCompleteProfile({ phone: phone.ok ? phone.value : '', nickname: data.nickname });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Ocurrió un error. Probá de nuevo.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <PhoneField
        countryRegistration={register('phoneCountry')}
        numberRegistration={register('phoneNumber')}
        country={phoneCountry}
        error={errors.phoneNumber?.message}
        autoFocus
      />

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
