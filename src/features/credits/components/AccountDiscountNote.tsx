import { Tag } from 'lucide-react';
import { formatDiscountExpiry } from '../packPricing';
import type { AccountDiscount } from '../types';

/** Nota "10% aplicado · vence lun 2/11 13:42" de la pantalla de compra (prototipo `Packs.dc.html`). */
export function AccountDiscountNote({ discount }: { discount: AccountDiscount }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
      >
        <Tag className="h-[17px] w-[17px]" />
      </span>
      <span className="flex flex-col gap-0.5 text-[13px] leading-snug">
        <span>
          <strong className="font-bold text-success">{discount.percent}% aplicado</strong>
          <span className="text-muted-foreground"> · vence {formatDiscountExpiry(discount.expiresAt)}</span>
        </span>
        <span className="text-xs text-muted-foreground">Descuento primeros 100. Se usa en esta compra.</span>
      </span>
    </div>
  );
}
