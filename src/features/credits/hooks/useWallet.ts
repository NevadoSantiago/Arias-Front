import { useQuery } from '@tanstack/react-query';
import { getWallet } from '../services/creditsApi';

/**
 * Billetera del usuario autenticado — AVAILABLE y COMMITTED, nunca sumados.
 * `enabled` (opcional, default `true`): quien solo la necesita en un momento
 * (la comanda de "Mis pedidos", F20) la pide recién entonces.
 */
export function useWallet({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['creditsWallet'],
    queryFn: getWallet,
    enabled,
  });
}
