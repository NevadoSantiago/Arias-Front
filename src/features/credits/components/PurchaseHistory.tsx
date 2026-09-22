import { useQuery } from '@tanstack/react-query';
import { getMovements } from '../services/creditsApi';
import type { CreditMovement, MovementType } from '../types';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  WELCOME_GRANT: 'Almuerzo de bienvenida',
  PACK_PURCHASE: 'Compra de paquete',
  DIRECT_PURCHASE: 'Compra directa',
  COMMIT: 'Comprometido en un pedido',
  RELEASE: 'Liberado',
  CONSUME: 'Consumido',
  EXPIRATION: 'Vencimiento',
  PAYMENT_REVERSAL: 'Reversión de pago',
  ADMIN_ADJUSTMENT: 'Ajuste administrativo',
};

function formatQuantity(movement: CreditMovement): string {
  const delta = movement.deltaAvailable !== 0 ? movement.deltaAvailable : movement.deltaCommitted;
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function formatDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Historial de movimientos en el orden en que el backend los devuelve —
 * el frontend no reordena ni recalcula nada (spec `credits-ui`, requisito
 * "Historial de movimientos legible").
 */
export function PurchaseHistory() {
  const { data: movements, isLoading, isError } = useQuery({
    queryKey: ['creditMovements'],
    queryFn: getMovements,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando historial…</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">No pudimos cargar tu historial.</p>;
  }

  if (!movements || movements.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no tenés movimientos.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {movements.map((movement) => (
        <li key={movement.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {MOVEMENT_LABELS[movement.type] ?? movement.type}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(movement.createdAt)}</p>
          </div>
          <span className="text-sm font-semibold text-foreground">{formatQuantity(movement)}</span>
        </li>
      ))}
    </ul>
  );
}
