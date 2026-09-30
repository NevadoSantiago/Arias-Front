import type { ReactNode } from 'react';
import { CreditCard, UtensilsCrossed, X } from 'lucide-react';
import chefCocinando from '@/assets/illustrations/Chef-Cocinando.svg';
import { cn } from '@/lib/utils';
import { OrderStatusBadge } from '../OrderStatusBadge';
import type { OrderEstado } from '../../types';
import type { ComandaFooter, ComandaItem } from './comandaModel';

/**
 * Fondo de "cocina" de las pantallas de comanda B2C: el chef a baja opacidad
 * detrás del contenido (mismo recurso y posición que `OrderSummary`, B2B,
 * que no se toca). Sin anchos fijos de teléfono: en escritorio lo puede
 * reusar cualquier contenedor.
 */
export function ChefBackdrop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <img
        src={chefCocinando}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[150px] h-auto w-[820px] max-w-none -translate-x-[46%] select-none opacity-[0.07]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

interface Props {
  orderId: number;
  /** "Jueves 24 de septiembre". */
  dateLabel: string;
  /** Nombre con el que la cocina llama al cliente (`displayName`). */
  callName: string;
  /** "Hoy, jueves 24 · 13:00 hs". */
  whenLabel: string;
  items: ComandaItem[];
  footer: ComandaFooter;
  /** Insignia de estado bajo la fecha (vista de comanda de "Mis pedidos"). */
  estado?: OrderEstado;
  /** Aspecto apagado (pedido cancelado). */
  muted?: boolean;
  /**
   * Optativo (F29) — cuando se pasa, cada plato lleva una "×" para quitarlo
   * (recibe la posición del plato). La página lo pasa solo si el pedido es
   * modificable; sin él la comanda queda igual que antes.
   */
  onRemoveItem?: (index: number) => void;
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{children}</span>;
}

function Divider() {
  return <div aria-hidden="true" className="border-t border-dashed border-primary/30" />;
}

/**
 * Comanda del pedido B2C (prototipo `Main.dc.html` / `MyOrders.dc.html`,
 * tablero v20): el papel de `OrderSummary` (riel, clips, papel rotado con
 * renglones rojos) pero con VARIOS platos, el nombre con el que se llama al
 * cliente en un recuadro y el pie de pago. Presentacional puro: los textos
 * salen de `comandaModel` y la página decide qué mostrar.
 */
export function OrderComanda({
  orderId,
  dateLabel,
  callName,
  whenLabel,
  items,
  footer,
  estado,
  muted = false,
  onRemoveItem,
}: Props) {
  const number = String(orderId).padStart(4, '0');
  return (
    <div data-testid="comanda" className={cn('flex flex-col', muted && 'opacity-60 grayscale')}>
      {/* Riel y clips que sostienen la comanda */}
      <div aria-hidden="true" className="h-[2px] bg-primary" />
      <div aria-hidden="true" className="h-px bg-primary/30" />
      <div aria-hidden="true" className="relative -mt-[2px] h-5">
        {(['left-[22%]', 'right-[22%]'] as const).map((side) => (
          <span key={side} className={cn('absolute top-0 flex flex-col items-center', side)}>
            <span className="h-1 w-1 rounded-full bg-primary" />
            <span className="h-4 w-3 rounded-b-sm bg-primary shadow-sm" />
          </span>
        ))}
      </div>

      <article
        aria-label={`Comanda número ${number}`}
        className="relative flex flex-col gap-[18px] bg-card px-[22px] pb-6 pt-[26px] shadow-2xl"
        style={{
          transform: 'rotate(-0.5deg)',
          // Renglones rojos sutiles, como papel de comanda (igual que OrderSummary).
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 31px,
            hsl(var(--primary) / 0.10) 31px,
            hsl(var(--primary) / 0.10) 32px
          )`,
        }}
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-display text-2xl font-bold uppercase leading-tight tracking-wider text-primary">
            Comanda Nº {number}
          </span>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
          {estado && (
            <span className="mt-1.5">
              <OrderStatusBadge estado={estado} />
            </span>
          )}
        </div>

        <Divider />

        <div className="flex flex-col items-center gap-1.5 rounded-md border-[1.5px] border-primary/35 bg-primary/[0.06] px-3 py-3.5 text-center">
          <Label>Te vamos a llamar como</Label>
          <span className="break-words font-display text-4xl font-black leading-[1.05] text-foreground">{callName}</span>
          <span className="text-[12.5px] leading-snug text-muted-foreground">
            Cuando esté listo, te llamamos por este nombre en el mostrador.
          </span>
        </div>

        <Divider />

        <div className="flex flex-col gap-[3px]">
          <Label>Retiro</Label>
          <span className="text-base font-bold text-foreground">{whenLabel}</span>
          <span className="text-[12.5px] text-muted-foreground">11 de Septiembre 4502</span>
        </div>

        <Divider />

        <div className="flex flex-col gap-2.5">
          <Label>Pedido</Label>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-1">
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[14.5px] font-bold uppercase leading-snug tracking-[0.04em] text-foreground">
                    {item.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold text-muted-foreground">
                    {item.costLabel}
                  </span>
                </span>
                <span className="flex items-center gap-2 pl-3.5">
                  <span className="text-[13px] text-muted-foreground">{item.side ?? 'sin acompañamiento'}</span>
                  {item.isNew && (
                    <span className="inline-flex h-[18px] items-center rounded-[3px] bg-success px-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-success-foreground">
                      Nuevo
                    </span>
                  )}
                </span>
                {item.note && (
                  <span className="ml-3.5 mt-1 flex flex-col gap-px border-l-2 border-primary/40 pl-2.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-primary/80">Nota</span>
                    <span className="text-[13px] italic text-foreground">{item.note}</span>
                  </span>
                )}
                </span>
                {onRemoveItem && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(i)}
                    aria-label={`Quitar ${item.name} del pedido`}
                    className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <Divider />

        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[12.5px] text-muted-foreground">{footer.label}</span>
            {footer.value && <span className="text-base font-bold text-foreground">{footer.value}</span>}
          </span>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary"
          >
            {footer.icon === 'card' ? (
              <CreditCard className="h-[22px] w-[22px]" aria-hidden="true" />
            ) : (
              <UtensilsCrossed className="h-[22px] w-[22px]" aria-hidden="true" />
            )}
          </span>
        </div>
      </article>
    </div>
  );
}
