import { CalendarDays, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, perLunchPriceCents } from '../packPricing';
import { expiryAfterPurchase, type PackCatalog, type PurchasePlan, type PurchaseSelection } from '../purchaseModel';
import { LooseCard } from './LooseCard';
import { PackNudge } from './PackNudge';
import { PackOptionCard } from './PackOptionCard';
import { PackPurchasePanel } from './PackPurchasePanel';

interface Props {
  catalog: PackCatalog;
  selection: PurchaseSelection | null;
  onSelect: (selection: PurchaseSelection) => void;
  qty: number;
  onQtyChange: (qty: number) => void;
  plan: PurchasePlan | null;
  onPay: () => void;
  isPending: boolean;
}

const NUDGE_FROM = 4;

function formatExpiry(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Página de paquetes en escritorio (F22c, prototipo `DesktopPacks.dc.html`):
 * Sueltos, Semana y Mes en tres tarjetas lado a lado y, a la derecha, el panel
 * fijo "Tu compra" con el pago directo. Reusa las tarjetas del móvil
 * (`LooseCard`, `PackOptionCard`) y el mismo plan de compra: los importes salen
 * de `/packs`, nunca se recalculan acá.
 */
export function PacksDesktopLayout({ catalog, selection, onSelect, qty, onQtyChange, plan, onPay, isPending }: Props) {
  const { dayPack, namedPacks, recommended, weekPack } = catalog;
  const loose = selection?.kind === 'loose';
  const showNudge = loose && qty >= NUDGE_FROM && !!weekPack;

  return (
    <div className="container grid max-w-6xl grid-cols-[minmax(0,1fr)_380px] items-start gap-10 py-8">
      <div className="flex min-w-0 flex-col gap-[22px]">
        <div className="flex flex-col gap-1.5">
          <Link
            to="/credits"
            className="-ml-1.5 inline-flex h-10 items-center gap-1 self-start px-1.5 text-sm font-semibold text-primary-deep no-underline"
          >
            <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            Mis almuerzos
          </Link>
          <h1 className="m-0 font-display text-[40px] font-bold leading-tight text-foreground">Comprar almuerzos</h1>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">
            Cuantos más llevás, menos pagás cada uno. Cada almuerzo es un plato del menú.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Elegí qué comprar"
          data-layout="cards"
          className="grid grid-cols-3 items-stretch gap-4"
        >
          {dayPack && (
            <LooseCard
              layout="stacked"
              checked={loose}
              onSelect={() => onSelect({ kind: 'loose' })}
              qty={qty}
              onQtyChange={onQtyChange}
              unitPriceLabel={formatPrice(dayPack.priceCents)}
              showNudge={false}
              onPickRecommended={() => {}}
            />
          )}
          {namedPacks.map((pack, i) => (
            <PackOptionCard
              key={pack.id}
              pack={pack}
              checked={selection?.kind === 'pack' && selection.packId === pack.id}
              onSelect={() => onSelect({ kind: 'pack', packId: pack.id })}
              recommended={recommended?.id === pack.id}
              stackLayers={i === 0 ? 2 : 5}
              priceLabel={formatPrice(pack.priceCents)}
              perLunchLabel={`${formatPrice(perLunchPriceCents(pack))} por almuerzo`}
            />
          ))}
        </div>

        {showNudge && weekPack && (
          <PackNudge pack={weekPack} actionLabel="Ver paquete" onPick={() => onSelect({ kind: 'pack', packId: weekPack.id })} />
        )}

        <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0">
          <li className="flex items-center gap-3 text-[13.5px] leading-relaxed text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-success">
              ✓
            </span>
            <span>Se suman a tu saldo apenas Mercado Pago confirma el pago.</span>
          </li>
          <li className="flex items-center gap-3 text-[13.5px] leading-relaxed text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary-deep">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>Vencen a los 90 días de tu última compra. Cada compra renueva el plazo.</span>
          </li>
        </ul>
      </div>

      {plan ? (
        <PackPurchasePanel
          selection={plan.checkout}
          expiryLabel={formatExpiry(expiryAfterPurchase())}
          onPay={onPay}
          isPending={isPending}
        />
      ) : (
        <aside aria-label="Tu compra" className="sticky top-6 mt-[46px] rounded-xl border border-border bg-card p-[22px]">
          <p className="m-0 text-sm text-muted-foreground">Elegí qué querés comprar.</p>
        </aside>
      )}
    </div>
  );
}
