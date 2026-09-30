import { describe, expect, it, vi } from 'vitest';
import {
  formatOrderDateLabel,
  formatOrderDayLabel,
  formatOrderPayDeadlineLabel,
  formatOrderTimeLabel,
  isRestaurantDayOnOrAfter,
  isSameRestaurantDay,
} from './orderDateLabels';

describe('formatOrderDayLabel', () => {
  const now = new Date('2026-09-26T10:00:00-03:00'); // sábado 26 de septiembre de 2026

  it('prefixes with "Hoy, " and keeps it lowercase when pickupAt falls on the same day as now', () => {
    const label = formatOrderDayLabel('2026-09-26T18:00:00-03:00', now);

    expect(label).toBe('Hoy, sábado, 26 de septiembre');
  });

  it('keeps "Hoy" after 21:00 local, when the UTC date has already rolled over', () => {
    // 22:30 del sábado en Buenos Aires = 01:30 del domingo en UTC.
    const lateNow = new Date('2026-09-26T22:00:00-03:00');

    expect(formatOrderDayLabel('2026-09-26T22:30:00-03:00', lateNow)).toBe('Hoy, sábado, 26 de septiembre');
    expect(formatOrderTimeLabel('2026-09-26T22:30:00-03:00')).toBe('22:30');
  });

  it('capitalizes the first letter and has no "Hoy, " prefix for a different day', () => {
    const label = formatOrderDayLabel('2026-09-27T18:00:00-03:00', now);

    expect(label).toBe('Domingo, 27 de septiembre');
    expect(label.startsWith('Hoy')).toBe(false);
  });
});

describe('formatOrderTimeLabel', () => {
  it('formats the pickup time as 24h "HH:MM"', () => {
    expect(formatOrderTimeLabel('2026-09-26T21:05:00-03:00')).toBe('21:05');
  });

  it('renders midnight as "00:05", not "24:05"', () => {
    expect(formatOrderTimeLabel('2026-09-26T00:05:00-03:00')).toBe('00:05');
  });

  it('renders 23:50 correctly, just before the day rolls over', () => {
    expect(formatOrderTimeLabel('2026-09-26T23:50:00-03:00')).toBe('23:50');
  });

  // Bug: on some ICU builds, `hour12: false` still renders midnight as
  // "24:00" instead of "00:00". `hourCycle: 'h23'` is the option that
  // actually forces a 0-23 hour range across ICU implementations — assert
  // the implementation uses it (and not `hour12: false`) so the fix is
  // verified regardless of this machine's own ICU behavior.
  it('formats using hourCycle "h23", not hour12:false', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    formatOrderTimeLabel('2026-09-26T00:05:00-03:00');

    expect(spy).toHaveBeenCalledWith('es-AR', expect.objectContaining({ hourCycle: 'h23' }));
    expect(spy).not.toHaveBeenCalledWith('es-AR', expect.objectContaining({ hour12: false }));

    spy.mockRestore();
  });
});

// F17: "Mis pedidos" usa esto para decidir si un CONFIRMADO cuenta como "de
// hoy" — misma zona horaria del restaurante que el resto de este módulo.
describe('isSameRestaurantDay', () => {
  const now = new Date('2026-09-26T10:00:00-03:00');

  it('is true when pickupAt falls on the same calendar day as now, even earlier in the day', () => {
    expect(isSameRestaurantDay('2026-09-26T08:00:00-03:00', now)).toBe(true);
  });

  it('is true right up to 21:00 local, when the UTC date has already rolled over', () => {
    const lateNow = new Date('2026-09-26T22:00:00-03:00');
    expect(isSameRestaurantDay('2026-09-26T22:30:00-03:00', lateNow)).toBe(true);
  });

  it('is false for a different calendar day, past or future', () => {
    expect(isSameRestaurantDay('2026-09-25T22:00:00-03:00', now)).toBe(false);
    expect(isSameRestaurantDay('2026-09-27T00:30:00-03:00', now)).toBe(false);
  });
});

// F17 fix: "Mis pedidos" usa esto para decidir si un CONFIRMADO cuenta como
// "próximo" por defecto — hoy o cualquier día posterior, no solo hoy.
describe('isRestaurantDayOnOrAfter', () => {
  const now = new Date('2026-09-26T10:00:00-03:00');

  it('is true when pickupAt falls on the same calendar day as now', () => {
    expect(isRestaurantDayOnOrAfter('2026-09-26T08:00:00-03:00', now)).toBe(true);
  });

  it('is true for a later calendar day, even earlier in the clock day', () => {
    expect(isRestaurantDayOnOrAfter('2026-09-27T00:30:00-03:00', now)).toBe(true);
  });

  it('is false for an earlier calendar day', () => {
    expect(isRestaurantDayOnOrAfter('2026-09-25T22:00:00-03:00', now)).toBe(false);
  });
});

// F18: "Pago pendiente" avisa la hora de corte (pickupAt − pickupLeadMinutes,
// en la zona del restaurante) a la que se cancela solo si Mercado Pago no
// confirmó el pago.
describe('formatOrderPayDeadlineLabel', () => {
  it('subtracts the lead minutes from pickupAt and formats it as "HH:MM" in the restaurant timezone', () => {
    expect(formatOrderPayDeadlineLabel('2026-09-26T13:00:00-03:00', 20)).toBe('12:40');
  });

  it('returns null when leadMinutes is null or undefined, so the caller can omit the time', () => {
    expect(formatOrderPayDeadlineLabel('2026-09-26T13:00:00-03:00', null)).toBeNull();
    expect(formatOrderPayDeadlineLabel('2026-09-26T13:00:00-03:00', undefined)).toBeNull();
  });

  it('renders a deadline at 00:05 (restaurant TZ) as "00:05", not "24:05"', () => {
    // pickupAt 00:25 − 20 min de antelación = 00:05.
    expect(formatOrderPayDeadlineLabel('2026-09-26T00:25:00-03:00', 20)).toBe('00:05');
  });

  it('renders a deadline at 23:50 (restaurant TZ) as "23:50"', () => {
    // pickupAt 2026-09-27T00:10 − 20 min de antelación = 2026-09-26T23:50.
    expect(formatOrderPayDeadlineLabel('2026-09-27T00:10:00-03:00', 20)).toBe('23:50');
  });

  // Same rationale as `formatOrderTimeLabel`'s hourCycle test above.
  it('formats using hourCycle "h23", not hour12:false', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    formatOrderPayDeadlineLabel('2026-09-26T00:25:00-03:00', 20);

    expect(spy).toHaveBeenCalledWith('es-AR', expect.objectContaining({ hourCycle: 'h23' }));
    expect(spy).not.toHaveBeenCalledWith('es-AR', expect.objectContaining({ hour12: false }));

    spy.mockRestore();
  });

  describe('formatOrderDateLabel', () => {
    it('is the calendar date without the "Hoy, " prefix, even for a same-day order', () => {
      expect(formatOrderDateLabel('2026-09-24T16:00:00Z')).toBe('Jueves 24 de septiembre');
      expect(formatOrderDateLabel('2026-09-25T02:30:00Z')).toBe('Jueves 24 de septiembre');
    });
  });
});
