import { describe, expect, it } from 'vitest';
import { ALL_STATIONS, matchesStation, STATION_LABEL } from './station';

describe('station helpers', () => {
  it('labels both stations in Spanish', () => {
    expect(STATION_LABEL).toEqual({ COCINA: 'Cocina', PARRILLA: 'Parrilla' });
  });

  it('matches every dish when the filter is "all"', () => {
    expect(matchesStation({ station: 'COCINA' }, ALL_STATIONS)).toBe(true);
    expect(matchesStation({ station: 'PARRILLA' }, ALL_STATIONS)).toBe(true);
  });

  it('matches only dishes of the selected station', () => {
    expect(matchesStation({ station: 'PARRILLA' }, 'PARRILLA')).toBe(true);
    expect(matchesStation({ station: 'COCINA' }, 'PARRILLA')).toBe(false);
    expect(matchesStation({ station: 'COCINA' }, 'COCINA')).toBe(true);
  });
});
