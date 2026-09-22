import { useQuery } from '@tanstack/react-query';
import { getWallet } from '../services/creditsApi';

/** Billetera del usuario autenticado — AVAILABLE y COMMITTED, nunca sumados. */
export function useWallet() {
  return useQuery({
    queryKey: ['creditsWallet'],
    queryFn: getWallet,
  });
}
