import type { DishStation } from '@/features/admin/services/adminApi';

export const ALL_STATIONS = 'all';

export type StationFilter = DishStation | typeof ALL_STATIONS;

export const STATION_LABEL: Record<DishStation, string> = {
  COCINA: 'Cocina',
  PARRILLA: 'Parrilla',
};

/** Client-side station filter: "all" keeps every dish. */
export function matchesStation(dish: { station: DishStation }, filter: StationFilter): boolean {
  return filter === ALL_STATIONS || dish.station === filter;
}
