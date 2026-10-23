import { useQuery } from '@tanstack/react-query';
import { getPrintAgentStatus } from '@/features/admin/services/adminApi';

/** The print agent is considered online by the backend if it polled in the last 30 s. */
export const AGENT_POLL_MS = 30_000;

export const PRINT_AGENT_KEY = ['adminPrintAgent'] as const;

/** Shared by the nav dot, the Ticketeras page and the kitchen board header. */
export function usePrintAgentStatus() {
  return useQuery({
    queryKey: PRINT_AGENT_KEY,
    queryFn: getPrintAgentStatus,
    refetchInterval: AGENT_POLL_MS,
  });
}
