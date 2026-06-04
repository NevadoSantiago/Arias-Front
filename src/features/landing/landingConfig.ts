/**
 * Configuración de contacto de la landing pública.
 *
 * El número de WhatsApp se toma de la variable de entorno VITE_WHATSAPP_NUMBER
 * (configurable en Cloudflare Pages para prod, o en un .env local). Si no está
 * seteada, usa el fallback de abajo para que dev no se rompa.
 *
 * Formato internacional sin "+", espacios ni guiones
 * (ej: 5491123456789 = +54 9 11 2345-6789).
 */
export const WHATSAPP_NUMBER =
  import.meta.env.VITE_WHATSAPP_NUMBER ?? '5491154211457';

/** Mensaje pre-cargado que se abre en WhatsApp al tocar el botón. */
export const WHATSAPP_MESSAGE =
  '¡Hola! Me gustaría saber más acerca del servicio de viandas empresariales.';

/** Construye el link wa.me con el mensaje pre-armado y url-encodeado. */
export function buildWhatsAppUrl(): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

/** Anclas de navegación (scroll suave entre secciones). */
export const SECTIONS = {
  diferenciadores: 'diferenciadores',
  quienes: 'quienes-somos',
  comoFunciona: 'como-funciona',
  features: 'features',
  menu: 'menu',
  cotizacion: 'cotizacion',
} as const;
