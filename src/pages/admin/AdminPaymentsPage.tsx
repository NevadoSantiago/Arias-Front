import { PaymentsView } from '@/features/admin/payments/PaymentsView';
import { usePaymentsReport } from '@/features/admin/payments/usePaymentsReport';

/**
 * Payments report: Mercado Pago purchases in a date range with the real per-payment fee.
 * Container only: filters and data live in `usePaymentsReport`, the screen in `PaymentsView`.
 */
export function AdminPaymentsPage() {
  const r = usePaymentsReport();
  return (
    <PaymentsView
      today={r.today}
      timezone={r.timezone}
      from={r.range?.from ?? ''}
      to={r.range?.to ?? ''}
      status={r.status}
      rangeInvalid={r.rangeInvalid}
      report={r.report}
      isLoading={r.isLoading}
      isError={r.isError}
      onFrom={r.setFrom}
      onTo={r.setTo}
      onRange={r.setRange}
      onStatus={r.setStatus}
      onRetry={r.refetch}
    />
  );
}
