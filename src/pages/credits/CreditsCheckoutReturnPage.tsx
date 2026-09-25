import { useParams, useSearchParams } from 'react-router-dom';
import { CreditsCheckoutStatus } from '@/features/credits/components/CreditsCheckoutStatus';

/**
 * Pantalla de retorno del checkout. La ruta real que arma el backend es
 * `/compras/{purchaseId}/procesando` (las tres back_urls de Mercado Pago
 * apuntan ahí); `/credits/checkout/{exito,pendiente,error}` se mantiene por
 * compatibilidad y toma el id del query string. En cualquier caso el
 * segmento de la URL es solo una pista: el estado real siempre sale de
 * `GET /api/v1/credits/purchases/{id}` (spec `credits-ui`).
 *
 * F7: `CreditsCheckoutStatus` ya trae su propio título y sus propias
 * acciones por estado (prototipo `Purchase{Pending,Approved,Rejected}.dc.html`),
 * así que esta pantalla no repite un título ni un botón "volver" genéricos.
 */
export function CreditsCheckoutReturnPage() {
  const [searchParams] = useSearchParams();
  const { purchaseId: purchaseIdParam } = useParams();
  const purchaseId = purchaseIdParam ?? searchParams.get('purchaseId');

  return (
    <div className="container max-w-md py-8">
      <CreditsCheckoutStatus purchaseId={purchaseId} />
    </div>
  );
}
