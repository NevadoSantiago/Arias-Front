import { cn } from '@/lib/utils';
import { formatLunches } from '@/features/orders/lunches';
import { packTagline } from '../packPricing';
import type { CreditPack } from '../types';
import {
  BestOptionRibbon,
  CountBlock,
  PriceBlock,
  SelectedSeal,
  TaglineRow,
} from './PackCardParts';
import { packCardFrameClasses, type PackCardLayout } from './packCardFrame';

interface Props {
  pack: CreditPack;
  checked: boolean;
  onSelect: () => void;
  /** true para el pack de mayor descuento: lleva la cinta "Mejor opción". */
  recommended: boolean;
  /** Total del pack ya formateado; solo se usa para el nombre accesible, la tarjeta no lo muestra. */
  priceLabel: string;
  /** Precio por almuerzo ya formateado (sin el texto "por almuerzo": lo agrega la tarjeta). */
  perLunchLabel: string;
  /**
   * `row` (default, móvil): el número y la palabra "almuerzos" en la misma línea.
   * `stacked` (escritorio): la palabra debajo del número, en la tarjeta angosta de la grilla.
   */
  layout?: PackCardLayout;
}

/**
 * Tarjeta radio de un pack con nombre (Semana, Mes, ...), siguiendo la pieza
 * gráfica de marca. El precio SIEMPRE viene de `priceCents` del pack, nunca
 * hardcodeado; el lema sale de la cantidad (`packTagline`).
 */
export function PackOptionCard({ pack, checked, onSelect, recommended, priceLabel, perLunchLabel, layout = 'row' }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${pack.nombre}, ${formatLunches(pack.creditAmount)}, ${priceLabel}`}
      onClick={onSelect}
      className={cn(packCardFrameClasses(checked), 'items-center gap-3 px-4 pt-5 text-left', recommended ? 'pb-8' : 'pb-5')}
    >
      {checked && <SelectedSeal />}
      <CountBlock count={pack.creditAmount} word={pack.creditAmount === 1 ? 'almuerzo' : 'almuerzos'} layout={layout} />
      <TaglineRow>{packTagline(pack.creditAmount)}</TaglineRow>
      <PriceBlock price={perLunchLabel} />
      {recommended && <BestOptionRibbon />}
    </button>
  );
}
