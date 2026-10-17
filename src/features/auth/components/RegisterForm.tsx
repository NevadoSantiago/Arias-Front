import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useAuthActions } from '../hooks/useAuthActions';
import { buildE164, phoneFields, refinePhone } from '../lib/phone';
import { DEFAULT_COUNTRY } from '../lib/countries';
import { PhoneField } from './PhoneField';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { GoogleSignInSection } from './GoogleSignInSection';
import { GoogleWelcomeScreen } from './GoogleWelcomeScreen';

const schema = z.object({
  firstName: z
    .string()
    .min(2, 'El nombre tiene que tener al menos 2 caracteres')
    .max(100),
  lastName: z.string().max(100).optional().or(z.literal('')),
  email: z.string().min(1, 'Ingresá tu email').email('El formato del email no es válido').max(255),
  ...phoneFields,
  nickname: z
    .string()
    .min(2, 'El apodo tiene que tener al menos 2 caracteres')
    .max(50),
  password: z
    .string()
    .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
    .max(72, 'La contraseña es demasiado larga'),
  confirmPassword: z.string(),
})
  .superRefine(refinePhone)
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
type FormData = z.infer<typeof schema>;

/**
 * Mapea el detalle de error del backend a campos específicos del formulario.
 *
 * `GlobalExceptionHandler.handleValidation` (backend) arma el `detail` de
 * @Valid como `"campo: mensaje; campo2: mensaje2"` — el nombre de campo
 * coincide 1:1 con las claves de {@link FIELD_MESSAGES}. Las reglas de
 * negocio (ej: teléfono duplicado) no traen ese prefijo pero su mensaje ya
 * viene en español y menciona el campo — se detectan por palabra clave.
 */
const FIELD_MESSAGES: Record<keyof FormData, string> = {
  firstName: 'Revisá el nombre ingresado.',
  lastName: 'Revisá el apellido ingresado.',
  email: 'Revisá el email ingresado.',
  phoneCountry: 'Revisá el país ingresado.',
  phoneNumber: 'Revisá el teléfono ingresado.',
  nickname: 'Ese apodo no es válido — probá con otro.',
  password: 'La contraseña no es válida.',
  confirmPassword: 'Las contraseñas no coinciden',
};

function mapServerFieldErrors(detail: string): Partial<Record<keyof FormData, string>> {
  const structural: Partial<Record<keyof FormData, string>> = {};
  for (const part of detail.split(';')) {
    const rawField = part.split(':')[0]?.trim();
    // The backend names the field `phone`; in the form it is `phoneNumber`.
    const field = rawField === 'phone' ? 'phoneNumber' : rawField;
    if (field && field in FIELD_MESSAGES) {
      structural[field as keyof FormData] = FIELD_MESSAGES[field as keyof FormData];
    }
  }
  if (Object.keys(structural).length > 0) {
    return structural;
  }

  // Regla de negocio sin prefijo estructural (ej: "Ese teléfono ya está
  // asociado a una cuenta") — el mensaje del backend ya es user-facing.
  const lower = detail.toLowerCase();
  if (lower.includes('teléfono') || lower.includes('telefono')) {
    return { phoneNumber: detail };
  }
  if (lower.includes('apodo')) {
    return { nickname: detail };
  }
  return {};
}

function phoneE164(data: FormData): string {
  const result = buildE164(data.phoneCountry, data.phoneNumber);
  // The schema already rejected invalid numbers, so this is always ok.
  return result.ok ? result.value : '';
}

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const { performRegister } = useAuthActions();
  const google = useGoogleSignIn();

  const {
    register: registerField,
    handleSubmit,
    setError,
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
      // confirmPassword is a client-side check only; never sent to the backend.
      await performRegister({
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        email: data.email,
        phone: phoneE164(data),
        nickname: data.nickname,
        password: data.password,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error. Probá de nuevo.';
      const fieldErrors = mapServerFieldErrors(message);
      if (Object.keys(fieldErrors).length > 0) {
        for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
          setError(field as keyof FormData, { type: 'server', message: fieldMessage });
        }
      } else {
        setServerError(message);
      }
    }
  };

  if (google.welcome) {
    return <GoogleWelcomeScreen google={google} />;
  }

  return (
    <>
      <GoogleSignInSection google={google} mode="register" dividerLabel="O registrate con tu email" />

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
              aria-invalid={!!errors.firstName}
              {...registerField('firstName')}
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
              {...registerField('lastName')}
            />
          </div>
        </div>

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
            {...registerField('email')}
          />
          {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
        </div>

        <PhoneField
          countryRegistration={registerField('phoneCountry')}
          numberRegistration={registerField('phoneNumber')}
          country={phoneCountry}
          error={errors.phoneNumber?.message}
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
            {...registerField('nickname')}
          />
          {errors.nickname && <p className="text-destructive text-xs mt-1">{errors.nickname.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="uppercase tracking-brand text-xs">
            Nueva contraseña
          </Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...registerField('password')}
          />
          {errors.password ? (
            <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
          ) : (
            <p className="text-muted-foreground text-xs mt-1">Mínimo 8 caracteres</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="uppercase tracking-brand text-xs">
            Repita la contraseña
          </Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...registerField('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && <p className="text-destructive text-xs">{serverError}</p>}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full uppercase tracking-brand font-medium"
          size="lg"
        >
          {isSubmitting ? 'Creando tu cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </>
  );
}
