import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WalletBalance } from '@/features/credits/components/WalletBalance';
import { PurchaseHistory } from '@/features/credits/components/PurchaseHistory';

/** Ruta `/credits` — billetera del usuario + historial de movimientos. */
export function CreditsWalletPage() {
  return (
    <div className="container py-8 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Mis almuerzos</h1>
        <Button asChild>
          <Link to="/credits/packs">Comprar más</Link>
        </Button>
      </div>

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
