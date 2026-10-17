export interface Country {
  /** ISO 3166-1 alpha-2 code. */
  iso: string;
  name: string;
  /** International dial code, digits only (no "+"). */
  dial: string;
  flag: string;
}

/** Argentina first (default); the rest alphabetical by name. */
export const COUNTRIES: Country[] = [
  { iso: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { iso: 'DE', name: 'Alemania', dial: '49', flag: '🇩🇪' },
  { iso: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴' },
  { iso: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { iso: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { iso: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴' },
  { iso: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨' },
  { iso: 'ES', name: 'España', dial: '34', flag: '🇪🇸' },
  { iso: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { iso: 'FR', name: 'Francia', dial: '33', flag: '🇫🇷' },
  { iso: 'IT', name: 'Italia', dial: '39', flag: '🇮🇹' },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽' },
  { iso: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾' },
  { iso: 'PE', name: 'Perú', dial: '51', flag: '🇵🇪' },
  { iso: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { iso: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { iso: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾' },
  { iso: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪' },
];

export const DEFAULT_COUNTRY = 'AR';
