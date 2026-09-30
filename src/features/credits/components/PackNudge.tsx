import type { CreditPack } from '../types';

interface Props {
  /** El pack hacia el que se empuja (Semana): nombre y cantidad salen de `/packs`. */
  pack: CreditPack;
  actionLabel: string;
  onPick: () => void;
  className?: string;
}

/**
 * Aviso de escritorio (F22c) para quien lleva 4 o más almuerzos sueltos: con el
 * paquete Semana cada uno sale más barato. Se muestra fuera de la tarjeta de
 * Sueltos (en la grilla no cabe adentro) y sin cifras inventadas.
 */
export function PackNudge({ pack, actionLabel, onPick, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border border-warning bg-warning/20 px-3.5 py-2.5 ${className}`}>
      <span className="flex-1 text-[13px] leading-relaxed text-foreground">
        Con el <strong className="font-bold">{pack.nombre}</strong> llevás {pack.creditAmount} y cada uno te sale más barato.
      </span>
      <button
        type="button"
        onClick={onPick}
        className="h-11 shrink-0 rounded-md border border-foreground px-3.5 text-[13.5px] font-bold text-foreground"
      >
        {actionLabel}
      </button>
    </div>
  );
}
