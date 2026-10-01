import { api } from '@/lib/api';
import type { CreditPurchaseStatus } from '@/features/credits/types';

export type PaymentKind = 'INDIVIDUAL' | 'SUGERIDO' | 'OTRO' | 'DIRECT';
export type PaymentStatusFilter = 'APPROVED' | 'ALL';

/** One purchase — matches `AdminPaymentRowDto`. Fee and net are null when Mercado Pago did not report them. */
export interface PaymentRow {
  purchaseId: string;
  occurredAt: string;
  customer: string;
  kind: PaymentKind;
  packName: string | null;
  orderId: number | null;
  credits: number;
  amountCents: number;
  status: CreditPurchaseStatus;
  mpPaymentId: string | null;
  feeCents: number | null;
  netCents: number | null;
  creditsReversed: number;
}

export interface KindBreakdown {
  kind: PaymentKind;
  count: number;
  grossCents: number;
}

/** Matches `AdminPaymentSummaryDto`: income figures count APPROVED purchases only. */
export interface PaymentSummary {
  approvedCount: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
  rowsWithoutFee: number;
  byKind: KindBreakdown[];
  inMediationCount: number;
  reversedCount: number;
}

export interface PaymentReport {
  rows: PaymentRow[];
  summary: PaymentSummary;
}

/** `from` / `to` are inclusive `YYYY-MM-DD` days in the restaurant timezone. */
export async function getAdminPayments(
  from: string,
  to: string,
  status: PaymentStatusFilter,
): Promise<PaymentReport> {
  const { data } = await api.get<PaymentReport>('/api/v1/admin/payments', {
    params: { from, to, status },
  });
  return data;
}
