import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPurchase } from '../services/creditsApi';
import type { CreditPurchaseStatus } from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

const FAILED_STATUSES: CreditPurchaseStatus[] = ['REJECTED', 'CANCELLED', 'REVERSED', 'EXPIRED'];

interface CreditsCheckoutStatusProps {
  purchaseId: string | null;
}

/**
 * Pantalla única de retorno del checkout — las tres rutas
 * (`exito`/`pendiente`/`error`) renderizan este mismo componente. El estado
 * mostrado depende SIEMPRE de lo que devuelve
 * `GET /api/v1/credits/purchases/{id}`, nunca del segmento de la URL, que es
 * solo una pista de Mercado Pago (spec `credits-ui`, requisito "La página de
 * retorno del checkout nunca afirma acreditación anticipada").
 *
 * Hace polling acotado (máximo {@link MAX_POLL_ATTEMPTS} intentos cada
 * {@link POLL_INTERVAL_MS} ms) mientras el estado sea `PENDING`. La
 * acreditación real ocurre solo vía webhook del backend — este componente
 * nunca escribe nada, solo lee y muestra.
 */
export function CreditsCheckoutStatus({ purchaseId }: CreditsCheckoutStatusProps) {
  const [attempts, setAttempts] = useState(0);
  const gaveUp = attempts >= MAX_POLL_ATTEMPTS;

  const { data: purchase, isLoading, isError, refetch } = useQuery({
    queryKey: ['creditPurchase', purchaseId],
    queryFn: () => getPurchase(purchaseId as string),
    enabled: Boolean(purchaseId),
    refetchInterval: false,
  });

  const status = purchase?.status;

  // Depends on the primitive `status` (not the `purchase` object) so a
  // refetch that resolves with the SAME status does not reschedule the
  // timer — only an actual `attempts` increment re-arms it, one poll at a
  // time, bounded by MAX_POLL_ATTEMPTS.
  useEffect(() => {
    if (!purchaseId || gaveUp) return;
    if (status !== 'PENDING') return;

    const timer = setTimeout(() => {
      setAttempts((a) => a + 1);
      void refetch();
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [status, gaveUp, purchaseId, refetch, attempts]);

  if (!purchaseId) {
    return (
      <p className="text-sm text-destructive">
        No pudimos identificar tu compra. Revisá tu historial en la sección de almuerzos.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Verificando el estado de tu compra…</p>;
  }

  if (isError || !purchase) {
    return <p className="text-sm text-destructive">No pudimos consultar el estado de tu compra.</p>;
  }

  if (purchase.status === 'PENDING' && gaveUp) {
    return (
      <p className="text-sm text-muted-foreground">
        Tu pago está demorando más de lo esperado. Te avisamos por correo apenas se acredite.
      </p>
    );
  }

  if (purchase.status === 'PENDING') {
    return <p className="text-sm text-muted-foreground">Estamos procesando tu pago…</p>;
  }

  if (purchase.status === 'APPROVED') {
    return (
      <p className="text-sm text-foreground">
        ¡Listo! Se acreditaron {purchase.creditAmount} almuerzos en tu billetera.
      </p>
    );
  }

  if (purchase.status === 'IN_MEDIATION') {
    return <p className="text-sm text-muted-foreground">Tu pago está en revisión.</p>;
  }

  if (FAILED_STATUSES.includes(purchase.status)) {
    return <p className="text-sm text-destructive">El pago no se pudo completar. No se acreditó ningún almuerzo.</p>;
  }

  return null;
}
