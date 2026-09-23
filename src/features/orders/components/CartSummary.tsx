import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatLunches } from '../lunches';
import type { CartLine } from '../hooks/useCart';

interface Props {
  lines: CartLine[];
  totalCredits: number;
  onRemove: (localId: string) => void;
  /**
   * true cuando la última confirmación falló por saldo insuficiente
   * (`InsufficientCreditsError` de `ordersApi`) — nunca calculado en el
   * cliente, siempre reportado por el backend al intentar confirmar.
   */
  insufficientBalance?: boolean;
}

/**
 * Lista del carrito + total, siempre en "almuerzos" — nunca "créditos"
 * (proposal `b2c-credits-pivot`, "Vocabulario"). El costo de cada línea sale
 * de `dish.category.creditCost`, tal como lo reportó el backend.
 */
export function CartSummary({ lines, totalCredits, onRemove, insufficientBalance }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no agregaste platos al carrito.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.localId}
            className="flex items-center justify-between gap-3 p-3 rounded-md border border-border"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{line.dish.nombre}</p>
              {line.sideNombre && (
                <p className="text-xs text-muted-foreground truncate">c/ {line.sideNombre.toLowerCase()}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatLunches(line.dish.category.creditCost)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(line.localId)}
                aria-label={`Quitar ${line.dish.nombre} del carrito`}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm font-semibold uppercase tracking-brand">Total</span>
        <span className="text-sm font-bold text-foreground">{formatLunches(totalCredits)}</span>
      </div>

      {insufficientBalance && (
        <div className="p-3 rounded-md border border-warning/50 bg-warning/10 text-xs text-foreground">
          No te alcanzan los almuerzos disponibles para este pedido.{' '}
          <Link to="/credits/packs" className="text-primary font-medium underline">
            Comprá un paquete
          </Link>
        </div>
      )}
    </div>
  );
}
