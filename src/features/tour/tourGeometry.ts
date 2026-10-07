export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Cutout {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  radius: number;
}

const MARGIN = 4;
const GUTTER = 12;
const MAX_BUBBLE = 420;
const GAP_TO_TARGET = 14;

/** Recorte de la capa oscura alrededor del elemento: con aire, dentro de la pantalla y con radio acotado. */
export function computeCutout(rect: Rect, viewport: Viewport, radius: number, pad = 6): Cutout {
  const left = Math.max(MARGIN, rect.x - pad);
  const top = Math.max(MARGIN, rect.y - pad);
  const right = Math.min(viewport.width - MARGIN, rect.x + rect.w + pad);
  const bottom = Math.min(viewport.height - MARGIN, rect.y + rect.h + pad);
  const width = right - left;
  const height = bottom - top;
  return { left, top, right, bottom, width, height, radius: Math.min(radius, height / 2) };
}

export interface TooltipPlacement {
  /** true: el globito va debajo del recorte; false: arriba. */
  below: boolean;
  top?: number;
  bottom?: number;
  left: number;
  /** Ancho del globito (el personaje va adentro). */
  width: number;
  /** true: el personaje va a la izquierda dentro del globito (el recorte está en la mitad derecha). */
  charOnLeft: boolean;
  /** Posición horizontal de la flechita, relativa al globito. */
  arrowLeft: number;
}

/** Dónde poner el globito (con el personaje adentro): del lado de la pantalla con más lugar y mirando al recorte. */
export function placeTooltip(cut: Cutout, viewport: Viewport): TooltipPlacement {
  const centerX = cut.left + cut.width / 2;
  const below = cut.top + cut.height / 2 < viewport.height / 2;
  const charOnLeft = centerX >= viewport.width / 2;

  const width = Math.min(viewport.width - GUTTER * 2, MAX_BUBBLE);
  const left = Math.max(GUTTER, Math.min(viewport.width - GUTTER - width, centerX - width / 2));

  const arrowLeft = Math.max(14, Math.min(width - 28, centerX - left - 7));

  return {
    below,
    top: below ? cut.bottom + GAP_TO_TARGET : undefined,
    bottom: below ? undefined : viewport.height - cut.top + GAP_TO_TARGET,
    left,
    width,
    charOnLeft,
    arrowLeft,
  };
}
