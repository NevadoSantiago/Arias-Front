import { useState } from 'react';
import { Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { daysUntil, expiryText } from '../timelineModel';

export interface ChosenDessert {
  nombre: string;
  fotoUrl: string | null;
}

interface Props {
  /** Postre de regalo vigente (ya ganado); `null` si no hay. */
  pending: { expiresAt: string } | null;
  /** El postre que el cliente sumó a este pedido; `null` si todavía no eligió. */
  chosen: ChosenDessert | null;
  /** "Te faltan N almuerzos…" cuando todavía no ganó el postre; `null` si no corresponde. */
  teaser: string | null;
  /** El carrito se suma a un pedido existente: el postre solo viaja en un pedido nuevo. */
  joinsExistingOrder?: boolean;
  onPick: () => void;
  onRemove: () => void;
}

/** Foto del postre con un tile liso cuando no hay foto o falla; decorativa (el nombre va al lado). */
export function DessertPhoto({ fotoUrl, size }: { fotoUrl: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (fotoUrl && !failed) {
    return (
      <img
        src={fotoUrl}
        alt=""
        style={box}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-lg bg-muted object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={box}
      className="flex shrink-0 items-center justify-center rounded-lg bg-muted text-primary-deep"
    >
      <Gift className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/**
 * El postre de regalo dentro de la revisión del pedido (prototipo "Pedido con postre"): tarjeta
 * punteada para elegirlo, línea sin cargo una vez elegido (cambiar / quitar) o, si todavía no lo
 * ganó, cuánto le falta. No toca los almuerzos del pedido.
 */
export function GiftDessertCard({ pending, chosen, teaser, joinsExistingOrder = false, onPick, onRemove }: Props) {
  if (!pending) {
    return teaser ? <p className="m-0 text-[13px] leading-snug text-muted-foreground">{teaser}</p> : null;
  }

  if (joinsExistingOrder) {
    return (
      <div role="status" className="flex flex-col gap-0.5 rounded-lg border-[1.5px] border-dashed border-border bg-card px-3.5 py-3">
        <strong className="text-sm font-bold text-foreground">Tenés un postre de regalo</strong>
        <span className="text-[13px] leading-snug text-muted-foreground">
          Va en un pedido nuevo: elegí otro horario para pedirlo con tu postre.
        </span>
      </div>
    );
  }

  if (chosen) {
    return (
      <div className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-success bg-card p-3">
        <div className="flex items-center gap-3">
          <DessertPhoto fotoUrl={chosen.fotoUrl} size={56} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-bold text-foreground">Postre de regalo — sin cargo</span>
            <span className="font-display text-[15px] font-bold text-foreground">{chosen.nombre}</span>
          </span>
          <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">Sin cargo</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPick}
            className="h-11 flex-1 rounded-md border-[1.5px] border-border bg-transparent text-[13px] font-bold text-foreground"
          >
            Cambiar postre
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="h-11 flex-1 rounded-md border-[1.5px] border-border bg-transparent text-[13px] font-bold text-primary-deep"
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = daysUntil(pending.expiresAt);
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-dashed border-primary-deep bg-card p-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-deep text-primary-foreground"
        >
          <Gift className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm font-bold text-foreground">Tenés un postre de regalo</span>
          <span className={cn('text-[12.5px] leading-snug', daysLeft <= 1 ? 'font-bold text-warning-deep' : 'text-muted-foreground')}>
            Sumalo a este pedido · {expiryText(daysLeft)}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={onPick}
        className="h-11 rounded-md bg-primary-deep text-[13px] font-bold uppercase tracking-brand text-primary-foreground"
      >
        Elegir postre
      </button>
    </div>
  );
}
