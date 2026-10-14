import { describe, expect, it } from 'vitest';
import { selectableDates } from './selectableDates';

describe('selectableDates', () => {
  it('on a weekday returns the current and next Monday–Friday weeks in display order', () => {
    expect(selectableDates('2026-09-30')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
    ]);
  });

  it('on a weekend (Saturday) returns the same two weeks, past days included', () => {
    expect(selectableDates('2026-09-26')).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
  });

  it('with includeWeekendToday on a weekend returns today followed by next week', () => {
    expect(selectableDates('2026-09-26', { includeWeekendToday: true })).toEqual([
      '2026-09-26',
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
  });

  it('with includeWeekendToday on a weekday ignores the option', () => {
    expect(selectableDates('2026-09-30', { includeWeekendToday: true })).toHaveLength(10);
  });
});
