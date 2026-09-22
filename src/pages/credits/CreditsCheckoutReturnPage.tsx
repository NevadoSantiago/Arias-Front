import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreditsCheckoutStatus } from '@/features/credits/components/CreditsCheckoutStatus';

/**
 * Pantalla de retorno del checkout. La ruta real que arma el backend es
 * `/compras/{purchaseId}/procesando` (las tres back_urls de Mercado Pago
 * apuntan ahí); `/credits/checkout/{exito,pendiente,error}` se mantiene por
 * compatibilidad y toma el id del query string. En cualquier caso el
 * segmento de la URL es solo una pista: el estado real siempre sale de
 * `GET /api/v1/credits/purchases/{id}` (spec `credits-ui`).
 */
export function CreditsCheckoutReturnPage() {
  const [searchParams] = useSearchParams();
  const { purchaseId: purchaseIdParam } = useParams();
  const purchaseId = purchaseIdParam ?? searchParams.get('purchaseId');

  return (
    <div className="container py-8 max-w-md space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Tu compra</h1>

      <CreditsCheckoutStatus purchaseId={purchaseId} />

      <Button asChild variant="outline">
        <Link to="/credits">Volver a mis almuerzos</Link>
      </Button>
    </div>
  );
}
