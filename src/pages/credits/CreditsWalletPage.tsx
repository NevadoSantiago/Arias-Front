import { WalletBalance } from '@/features/credits/components/WalletBalance';
import { PurchaseHistory } from '@/features/credits/components/PurchaseHistory';

/**
 * Ruta `/credits` — billetera del usuario + historial de movimientos (F5,
 * prototipo `Credits.dc.html`). El llamado a comprar más vive dentro de
 * `WalletBalance` (debajo de la tarjeta de saldo), así que la página no
 * repite un segundo botón.
 */
export function CreditsWalletPage() {
  return (
    <div className="container py-8 space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Mis almuerzos</h1>

      <WalletBalance />

      <div>
        <h2 className="text-sm uppercase tracking-brand font-medium text-muted-foreground mb-3">
          Historial
        </h2>
        <PurchaseHistory />
      </div>
    </div>
  );
}
