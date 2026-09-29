import { WalletBalance } from '@/features/credits/components/WalletBalance';
import { PurchaseHistory } from '@/features/credits/components/PurchaseHistory';
import { BuyLunchesAside } from '@/features/credits/components/BuyLunchesAside';
import { useIsDesktop } from '@/lib/useMediaQuery';

/**
 * Ruta `/credits` — billetera del usuario + historial de movimientos (F5,
 * prototipo `Credits.dc.html`). En móvil el llamado a comprar más vive dentro
 * de `WalletBalance` (debajo de la tarjeta de saldo). En escritorio (F22c,
 * `DesktopCredits.dc.html`) el saldo va en horizontal sobre los movimientos y
 * la compra se hace en el lugar, en el panel lateral `BuyLunchesAside`.
 */
export function CreditsWalletPage() {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div className="container grid max-w-6xl grid-cols-[minmax(0,1fr)_380px] items-start gap-10 py-10">
        <div className="flex min-w-0 flex-col gap-6">
          <h1 className="font-display text-[42px] font-bold leading-tight text-foreground">Mis almuerzos</h1>

          <WalletBalance variant="wide" />

          <section aria-labelledby="movements-title" className="flex flex-col gap-2">
            <h2
              id="movements-title"
              className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-brand text-muted-foreground"
            >
              Movimientos
            </h2>
            <PurchaseHistory layout="wide" />
          </section>
        </div>

        <BuyLunchesAside />
      </div>
    );
  }

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
