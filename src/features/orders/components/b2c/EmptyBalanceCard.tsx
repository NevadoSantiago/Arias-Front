import { UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Tarjeta de "sin almuerzos" (F4, prototipo `OrderEmpty.dc.html`) — se
 * muestra cuando el saldo disponible es 0. El servidor sigue siendo la
 * única autoridad sobre saldo insuficiente al confirmar; esto es solo
 * orientación para que el cliente cargue almuerzos antes de pedir.
 */
export function EmptyBalanceCard() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-5 py-7 text-center">
      <UtensilsCrossed className="h-[52px] w-[52px] text-muted-foreground/60" aria-hidden="true" />
      <h2 className="font-display text-xl font-bold leading-tight text-foreground">Te quedaste sin almuerzos</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Cargá almuerzos para pedir tu plato. Con un paquete, cada almuerzo te sale más barato.
      </p>
      <Link
        to="/credits/packs"
        className="mt-1 flex h-11 items-center rounded-md bg-primary-deep px-5 text-sm font-bold text-primary-foreground no-underline"
      >
        Comprar almuerzos
      </Link>
    </div>
  );
}
