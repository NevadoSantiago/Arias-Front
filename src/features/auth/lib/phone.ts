import { z } from 'zod';
import { COUNTRIES } from './countries';

const EMPTY_MESSAGE = 'Ingresá tu celular';
const DIGITS_MESSAGE = 'Usá solo números';

export type E164Result = { ok: true; value: string } | { ok: false; message: string };

/**
 * Builds the E.164-style number the backend expects from a country and the
 * national number typed by the user. Spaces, hyphens, dots and parentheses are
 * ignored. No digit count is enforced: any non-empty digit string is accepted.
 * Argentina gets the mobile "9" added, giving `+549...`; other countries get
 * `+<dial><digits>`.
 */
export function buildE164(iso: string, national: string): E164Result {
  const country = COUNTRIES.find((c) => c.iso === iso);
  if (!country) return { ok: false, message: 'Elegí un país' };
  const digits = national.replace(/[\s\-.()]/g, '');
  if (digits === '') return { ok: false, message: EMPTY_MESSAGE };
  if (!/^\d+$/.test(digits)) return { ok: false, message: DIGITS_MESSAGE };
  return { ok: true, value: iso === 'AR' ? `+549${digits}` : `+${country.dial}${digits}` };
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
