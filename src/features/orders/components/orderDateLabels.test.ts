import { describe, expect, it } from 'vitest';
import { formatOrderDayLabel, formatOrderTimeLabel } from './orderDateLabels';

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
});
