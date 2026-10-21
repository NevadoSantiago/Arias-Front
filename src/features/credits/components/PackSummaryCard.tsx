import { Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLunches } from '@/features/orders/lunches';
import type { CreditPack } from '../types';
import { BestOptionRibbon, SelectedSeal } from './PackCardParts';
import { SummaryDivider, SummaryHeader, SummaryRow } from './SummaryCardParts';
import { packSummaryFrameClasses } from './packCardFrame';

interface Props {
  pack: CreditPack;
  checked: boolean;
  onSelect: () => void;
  /** true para el pack de mayor descuento: lleva la cinta "Mejor opción". */
  recommended: boolean;
  /** Total del pack ya formateado; solo se usa para el nombre accesible, la tarjeta no lo muestra. */
  priceLabel: string;
  /** Precio por almuerzo ya formateado. */
  perLunchLabel: string;
  /** Lema de la tarjeta (el del admin, o el que se deduce de la cantidad). */
  lema: string;
}

/**
 * Tarjeta radio de un pack en el celular, con el formato de la hoja "Revisá tu
 * compra" sin el total: nombre, cantidad, lema, precio por almuerzo y descuento.
 */
export function PackSummaryCard({ pack, checked, onSelect, recommended, priceLabel, perLunchLabel, lema }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${pack.nombre}, ${formatLunches(pack.creditAmount)}, ${priceLabel}`}
      onClick={onSelect}
      className={cn(packSummaryFrameClasses(checked), 'cursor-pointer text-left', recommended && 'pb-8')}
    >
      {checked && <SelectedSeal />}
      <SummaryHeader
        icon={<Banknote className="h-6 w-6" />}
        name={pack.nombre}
        amount={formatLunches(pack.creditAmount)}
        lema={lema}
      />
      <SummaryDivider />
      <span className="flex flex-col gap-2.5">
        <SummaryRow label="Precio por almuerzo" value={perLunchLabel} />
        {pack.discountPercent > 0 && (
          <SummaryRow label="Descuento" value={`−${pack.discountPercent}%`} valueClassName="font-bold text-success" />
        )}
      </span>
      {recommended && <BestOptionRibbon />}
    </button>
  );
}
