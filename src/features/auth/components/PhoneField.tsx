import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { COUNTRIES, DEFAULT_COUNTRY } from '../lib/countries';

interface PhoneFieldProps {
  /** `register('phoneCountry')` of the host form. */
  countryRegistration: UseFormRegisterReturn;
  /** `register('phoneNumber')` of the host form. */
  numberRegistration: UseFormRegisterReturn;
  /** Currently selected ISO code (watched by the host form). */
  country: string;
  error?: string;
  autoFocus?: boolean;
}

/**
 * Country dial-code selector + national number input. Presentational: the host
 * form owns the values (`phoneCountry`, `phoneNumber`) and the validation.
 * A native `<select>` is used on purpose: it gets the OS picker on phones and
 * is reliably testable, unlike the Radix select in jsdom.
 */
export function PhoneField({
  countryRegistration,
  numberRegistration,
  country,
  error,
  autoFocus,
}: PhoneFieldProps) {
  const isArgentina = (country || DEFAULT_COUNTRY) === 'AR';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="phoneCountry" className="uppercase tracking-brand text-xs">
            País
          </Label>
          <select
            id="phoneCountry"
            defaultValue={DEFAULT_COUNTRY}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-base',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm',
            )}
            {...countryRegistration}
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.flag} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber" className="uppercase tracking-brand text-xs">
            Celular
          </Label>
          <Input
            id="phoneNumber"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus={autoFocus}
            placeholder={isArgentina ? '1159876547' : ''}
            aria-invalid={!!error}
            {...numberRegistration}
          />
        </div>
      </div>
      {error ? (
        <p className="text-destructive text-xs mt-1">{error}</p>
      ) : (
        isArgentina && <p className="text-muted-foreground text-xs mt-1">Sin 0 ni 15. Ej: 1159876547</p>
      )}
    </div>
  );
}
