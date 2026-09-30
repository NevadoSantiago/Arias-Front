import { z } from 'zod';

const PHONE_MESSAGE = 'Ingresá los 10 dígitos de tu celular';

/**
 * Celular argentino: exactamente 10 dígitos (característica sin 0 + número sin
 * 15, ej: 1159876547). Acepta espacios y guiones al tipear pero devuelve solo
 * los dígitos; el backend guarda `+549` + esos dígitos.
 */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\d{10}$/, PHONE_MESSAGE));
