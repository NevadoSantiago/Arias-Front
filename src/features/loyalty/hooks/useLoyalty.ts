import { useQuery } from '@tanstack/react-query';
import { getLoyalty } from '../services/loyaltyApi';

/** Línea de beneficios del usuario. Un error se trata como "sin línea": nunca debe romper el inicio. */
export function useLoyalty() {
  return useQuery({
    queryKey: ['loyalty'],
    queryFn: getLoyalty,
    retry: 1,
    staleTime: 30_000,
  });
}
