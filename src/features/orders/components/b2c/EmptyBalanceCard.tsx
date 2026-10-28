import { Link } from 'react-router-dom';
import esperandoMesa from '@/assets/illustrations/EsperandoMesa-transparente.svg';

/**
 * Tarjeta de "sin almuerzos" (F4) — se muestra cuando el saldo disponible es
 * 0. Variante A del prototipo de diseño (2026-10-22): el personaje de Arias
 * esperando en la mesa, sobre una franja clara arriba de la tarjeta. El
 * servidor sigue siendo la única autoridad sobre saldo insuficiente al
 * confirmar; esto es solo orientación para que el cliente cargue almuerzos
 * antes de pedir.
 */
export function EmptyBalanceCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-center">
      <div className="flex justify-center bg-secondary px-5 pt-4">
        <img
          data-testid="empty-balance-illustration"
          src={esperandoMesa}
          alt=""
          aria-hidden="true"
          className="pointer-events-none h-36 w-auto select-none object-contain"
        />
      </div>
      <div className="flex flex-col items-center gap-3 px-5 pb-6 pt-5">
        <h2 className="font-display text-xl font-bold leading-tight text-foreground">
          Tu próximo almuerzo te está esperando
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Se te terminaron los almuerzos. Cargá un paquete y seguí comiendo rico: cuantos más
          llevás, menos pagás cada uno.
        </p>
        <Link
          to="/credits?comprar=1"
          className="mt-1 flex h-12 w-full items-center justify-center rounded-md bg-primary-deep px-5 lg:w-auto lg:px-10 text-sm font-bold text-primary-foreground no-underline"
        >
          Cargar almuerzos
        </Link>
      </div>
    </div>
  );
}
