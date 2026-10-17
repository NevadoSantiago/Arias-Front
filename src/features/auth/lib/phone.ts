import { z } from 'zod';
import { COUNTRIES } from './countries';

const AR_MESSAGE = 'Ingresá los 10 dígitos de tu celular';
const FOREIGN_MESSAGE = 'Ingresá entre 6 y 14 dígitos, sin el código de país';

export type E164Result = { ok: true; value: string } | { ok: false; message: string };

/**
 * Builds the E.164 number the backend expects from a country and the national
 * number typed by the user. Spaces, hyphens, dots and parentheses are ignored.
 * Argentina: exactly 10 digits (area code without 0 + number without 15); the
 * mobile "9" is added, giving `+549…`. Other countries: 6 to 14 digits.
 */
export function buildE164(iso: string, national: string): E164Result {
  const country = COUNTRIES.find((c) => c.iso === iso);
  if (!country) return { ok: false, message: 'Elegí un país' };
  const digits = national.replace(/[\s\-.()]/g, '');
  if (iso === 'AR') {
    return /^\d{10}$/.test(digits)
      ? { ok: true, value: `+549${digits}` }
      : { ok: false, message: AR_MESSAGE };
  }
  return /^\d{6,14}$/.test(digits)
    ? { ok: true, value: `+${country.dial}${digits}` }
    : { ok: false, message: FOREIGN_MESSAGE };
}

/** Form shape shared by every form that asks for a phone. */
export const phoneFields = {
  phoneCountry: z.string(),
  phoneNumber: z.string(),
};

/** `superRefine` callback: validates the pair and reports on `phoneNumber`. */
export function refinePhone(
  data: { phoneCountry: string; phoneNumber: string },
  ctx: z.RefinementCtx,
) {
  const result = buildE164(data.phoneCountry, data.phoneNumber);
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: result.message, path: ['phoneNumber'] });
  }
}

export const phoneFieldsSchema = z.object(phoneFields).superRefine(refinePhone);
