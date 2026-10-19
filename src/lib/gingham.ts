/** Arias paper and ink: the light box of the balance board (v28 prototype). */
export const PAPER = '#FFFCF5';
export const INK = '#1A110F';
/** Secondary text on paper (dates, captions, labels). */
export const PAPER_MUTED = '#67514C';

/**
 * Soft red gingham tablecloth: 12px stripes repeating every 24px, both
 * horizontally and vertically, over Arias paper. Shared by the balance boxes
 * (lunches page and desktop My orders side panel). Inline style because the
 * gradient pair is not expressible as a single Tailwind utility.
 */
export const GINGHAM_STYLE = {
  backgroundColor: PAPER,
  backgroundImage: [
    'repeating-linear-gradient(90deg, rgba(220,44,46,0.08) 0 12px, transparent 12px 24px)',
    'repeating-linear-gradient(0deg, rgba(220,44,46,0.08) 0 12px, transparent 12px 24px)',
  ].join(', '),
  borderColor: 'rgba(220,44,46,0.28)',
  color: INK,
} as const;
