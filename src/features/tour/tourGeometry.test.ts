import { describe, expect, it } from 'vitest';
import { computeCutout, placeTooltip } from './tourGeometry';

const phone = { width: 390, height: 844 };

describe('computeCutout', () => {
  it('pads the target rect and rounds it up to the requested radius', () => {
    const cut = computeCutout({ x: 100, y: 200, w: 80, h: 40 }, phone, 8);

    expect(cut).toMatchObject({ left: 94, top: 194, width: 92, height: 52, radius: 8 });
  });

  it('never lets the radius exceed half the cutout height (pill shapes)', () => {
    const cut = computeCutout({ x: 100, y: 200, w: 80, h: 40 }, phone, 999);

    expect(cut.radius).toBe(26);
  });

  it('clamps the cutout inside the viewport with a 4px margin', () => {
    const cut = computeCutout({ x: 0, y: 0, w: 390, h: 844 }, phone, 8);

    expect(cut).toMatchObject({ left: 4, top: 4, right: 386, bottom: 840 });
  });
});

describe('placeTooltip', () => {
  it('puts the bubble below a target in the top half and the character on the side far from it', () => {
    const cut = computeCutout({ x: 20, y: 10, w: 100, h: 44 }, phone, 8);

    const place = placeTooltip(cut, phone);

    expect(place.below).toBe(true);
    expect(place.top).toBe(cut.bottom + 14);
    // target on the left half -> character on the right, facing the target
    expect(place.charOnLeft).toBe(false);
  });

  it('puts the bubble above a target in the bottom half and the character on the left when the target is on the right', () => {
    const cut = computeCutout({ x: 250, y: 700, w: 100, h: 44 }, phone, 8);

    const place = placeTooltip(cut, phone);

    expect(place.below).toBe(false);
    expect(place.bottom).toBe(phone.height - cut.top + 14);
    expect(place.charOnLeft).toBe(true);
  });

  it('uses the full phone width minus a 12px gutter on small screens', () => {
    const place = placeTooltip(computeCutout({ x: 20, y: 10, w: 100, h: 44 }, phone, 8), phone);

    expect(place.left).toBe(12);
    expect(place.width).toBe(366);
  });

  it('caps the bubble width on wide screens and keeps it next to the target', () => {
    const desktop = { width: 1440, height: 900 };
    const place = placeTooltip(computeCutout({ x: 1200, y: 10, w: 100, h: 44 }, desktop, 8), desktop);

    expect(place.width).toBe(420);
    expect(place.left + place.width).toBeLessThanOrEqual(desktop.width - 12);
    expect(place.left).toBeGreaterThan(700);
  });

  it('keeps the arrow inside the full-width bubble', () => {
    const cut = computeCutout({ x: 20, y: 10, w: 100, h: 44 }, phone, 8);

    const place = placeTooltip(cut, phone);

    expect(place.arrowLeft).toBeGreaterThanOrEqual(14);
    expect(place.arrowLeft).toBeLessThanOrEqual(place.width - 28);
  });

  it('points the arrow at the cutout center relative to the whole bubble', () => {
    const cut = computeCutout({ x: 250, y: 700, w: 100, h: 44 }, phone, 8);

    const place = placeTooltip(cut, phone);

    // centro del recorte (300) - borde izquierdo del globito (12) - mitad de la flecha (7)
    expect(place.arrowLeft).toBe(300 - place.left - 7);
  });

  it('clamps the arrow to the right edge of the bubble for targets in the corner', () => {
    const cut = computeCutout({ x: 340, y: 700, w: 46, h: 44 }, phone, 8);

    const place = placeTooltip(cut, phone);

    expect(place.arrowLeft).toBe(place.width - 28);
  });
});
