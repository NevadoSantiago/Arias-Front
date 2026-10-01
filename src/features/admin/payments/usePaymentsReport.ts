import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRestaurantConfigAdmin } from '@/features/admin/services/adminApi';
import { getAdminPayments, type PaymentStatusFilter } from './paymentsApi';
import { quickRange, todayIn } from './paymentsReport';

/** Used only if the restaurant config cannot be read. */
const FALLBACK_TIMEZONE = 'America/Argentina/Buenos_Aires';

interface Range {
  from: string;
  to: string;
}

/** Filters, restaurant-timezone "today" and the report query. Default: last 7 days, approved only. */
export function usePaymentsReport() {
  const config = useQuery({ queryKey: ['adminRestaurantConfig'], queryFn: getRestaurantConfigAdmin });
  const timezone = config.data?.timezone ?? (config.isError ? FALLBACK_TIMEZONE : null);

  const [picked, setPicked] = useState<Range | null>(null);
  const [status, setStatus] = useState<PaymentStatusFilter>('APPROVED');

  const today = useMemo(() => (timezone ? todayIn(timezone, new Date()) : null), [timezone]);
  const range = picked ?? (today ? quickRange('7d', today) : null);
  const rangeInvalid = range !== null && range.from > range.to;

  const report = useQuery({
    queryKey: ['adminPayments', range?.from, range?.to, status],
    queryFn: () => getAdminPayments(range!.from, range!.to, status),
    enabled: range !== null && !rangeInvalid,
  });

  return {
    timezone,
    today,
    range,
    rangeInvalid,
    status,
    setStatus,
    setFrom: (from: string) => range && setPicked({ ...range, from }),
    setTo: (to: string) => range && setPicked({ ...range, to }),
    setRange: setPicked,
    report: report.data ?? null,
    isLoading: report.isLoading || (range === null && !config.isError),
    isError: report.isError,
    refetch: () => void report.refetch(),
  };
}
