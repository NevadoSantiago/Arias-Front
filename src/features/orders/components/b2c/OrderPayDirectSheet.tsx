import { Clock3, CreditCard, Package2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { getPacks } from '@/features/credits/services/creditsApi';
import { formatPrice, perLunchPriceCents, pickRecommended } from '@/features/credits/packPricing';
import { formatLunches } from '../../lunches';
import type { CartLine } from '../../hooks/useCart';

const DAY_CODE = 'DAY';

interface Props {
  open: boolean;
  onClose: () => void;
  /** "Retiro hoy 13:00 hs" / "Retiro lunes a las 13:00 hs" — mismo texto que el botón de confirmar. */
  pickupLabel: string;
  lines: CartLine[];
  totalLunches: number;
  /** Saldo disponible ANTES de este pedido (0 o parcial) — solo para el subtítulo/nota, nunca decide nada. */
  walletAvailable: number;
  onPay: () => void;
  paying: boolean;
  payError: string | null;
  /** `sheet` (default): hoja móvil. `dialog`: diálogo centrado para escritorio (F22a) — mismo contenido y handlers. */
  presentation?: 'sheet' | 'dialog';
}

/**
 * "Pagá este pedido con Mercado Pago" (F18, prototipo `OrderPayDirect.dc.html`,
 * D3 aprobado) — se abre cuando `placeOrderV2` rechaza un pedido NUEVO con
 * `InsufficientCreditsError` (el servidor sigue decidiendo el saldo; acá solo
 * se reacciona a su respuesta). El precio por almuerzo y el total son SOLO
 * informativos, calculados del lado del cliente a partir del pack `DAY`
 * (`priceCents / creditAmount`, redondeo hacia arriba, igual que el backend);
 * el cobro real lo determina siempre `startDirectCheckoutV2`.
 */
export function OrderPayDirectSheet({
  open,
  onClose,
  pickupLabel,
  lines,
  totalLunches,
  walletAvailable,
  onPay,
  paying,
  payError,
  presentation = 'sheet',
}: Props) {
  const { data: packs, isLoading: packsLoading, isError: packsError } = useQuery({
    queryKey: ['creditPacks'],
    queryFn: getPacks,
    enabled: open,
  });

  const dayPack = packs?.find((p) => p.code === DAY_CODE && p.enabled) ?? null;
  const namedPacks = (packs ?? []).filter((p) => p.code !== DAY_CODE && p.enabled);
  const recommended = pickRecommended(namedPacks);

  // Redondeo hacia arriba: mismo criterio que `unitPriceCentsFor` en el
  // backend (`CreditPurchaseService`) — nunca mostrar de menos.
  const perLunchCents = dayPack ? Math.ceil(dayPack.priceCents / dayPack.creditAmount) : null;
  const totalCents = perLunchCents !== null ? perLunchCents * totalLunches : null;

  // Fix de review: si `getPacks` falla o no hay un pack DAY habilitado, el
  // precio es desconocido — antes el botón quedaba habilitado con un total
  // "—" y "Pagar  con Mercado Pago" (doble espacio). Ahora se deshabilita y
  // se explica el motivo en vez de dejar pagar un monto que no se pudo
  // calcular.
  const priceUnavailable = !packsLoading && (packsError || perLunchCents === null);

  const recommendedPerLunchCents = recommended ? perLunchPriceCents(recommended) : null;
  const showCallout =
    !!recommended &&
    recommendedPerLunchCents !== null &&
    perLunchCents !== null &&
    recommendedPerLunchCents < perLunchCents;

  const zero = walletAvailable === 0;
  const subtitle = zero
    ? 'No tenés almuerzos disponibles. Pagás solo este pedido y listo.'
    : `Tenés ${formatLunches(walletAvailable)} y este pedido usa ${formatLunches(totalLunches)}.`;
  const partialNote = zero
    ? null
    : `Pagás el pedido completo con Mercado Pago. ${
        walletAvailable === 1
          ? 'Tu almuerzo disponible queda intacto'
          : `Tus ${walletAvailable} almuerzos disponibles quedan intactos`
      } para otro día.`;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent aria-label="Pagá este pedido con Mercado Pago" variant={presentation} className={presentation === 'dialog' ? 'max-w-[600px] p-0' : 'p-0'}>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-primary-foreground"
            >
              <CreditCard className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <SheetTitle>Pagá este pedido con Mercado Pago</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">{subtitle}</SheetDescription>
            </div>
          </div>

          {partialNote && (
            <p className="m-0 rounded-md border border-warning bg-warning/20 p-3 text-[13.5px] leading-relaxed text-foreground">
              {partialNote}
            </p>
          )}

          <div className="rounded-md border border-border bg-background">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-3.5">
              {lines.map((line) => (
                <li key={line.localId} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold text-foreground">{line.dish.nombre}</span>
                    {line.sideNombre && (
                      <span className="text-muted-foreground"> · {line.sideNombre.toLowerCase()}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatLunches(line.dish.category.creditCost)}
                  </span>
                </li>
              ))}
            </ul>
            <div aria-hidden="true" className="border-t border-dashed border-border" />
            <p className="m-0 flex items-center gap-1.5 p-3.5 text-[13.5px] font-semibold text-foreground">
              <Clock3 className="h-[15px] w-[15px] text-primary-deep" aria-hidden="true" />
              {pickupLabel}
            </p>
            <div aria-hidden="true" className="border-t border-dashed border-border" />
            <div className="flex items-baseline justify-between gap-3 p-3.5">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-foreground">Total</span>
                {perLunchCents !== null && (
                  <span className="text-xs text-muted-foreground">{`${totalLunches} × ${formatPrice(perLunchCents)}`}</span>
                )}
              </span>
              <span className="text-lg font-bold text-foreground">
                {totalCents !== null ? formatPrice(totalCents) : '—'}{' '}
                <span className="text-sm font-semibold text-muted-foreground">· {formatLunches(totalLunches)}</span>
              </span>
            </div>
          </div>

          {showCallout && recommended && (
            <div className="flex items-start gap-3 rounded-md bg-muted p-3.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary-deep"
              >
                <Package2 className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="text-[13.5px] leading-relaxed text-foreground">
                  Con el <strong className="font-bold">{recommended.nombre}</strong> cada almuerzo te sale{' '}
                  {formatPrice(recommendedPerLunchCents!)} (ahorrás {recommended.discountPercent}%).
                </span>
                <Link
                  to="/credits/packs"
                  className="flex h-11 w-fit items-center text-[13.5px] font-bold text-primary-deep"
                >
                  Ver paquetes
                </Link>
              </span>
            </div>
          )}

          {priceUnavailable && (
            <div className="flex flex-col gap-1.5 rounded-md border border-destructive bg-destructive/10 p-3.5">
              <p role="alert" className="m-0 text-[13.5px] leading-relaxed text-foreground">
                No pudimos calcular el precio. Probá de nuevo en un momento o comprá un paquete.
              </p>
              <Link to="/credits/packs" className="flex h-11 w-fit items-center text-[13.5px] font-bold text-primary-deep">
                Ver paquetes
              </Link>
            </div>
          )}

          {payError && (
            <p role="alert" className="text-xs text-destructive">
              {payError}
            </p>
          )}
        </div>
        <SheetFooter>
          <button
            type="button"
            onClick={onPay}
            disabled={paying || packsLoading || priceUnavailable}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
          >
            {paying
              ? 'Redirigiendo…'
              : packsLoading
                ? 'Calculando precio…'
                : totalCents !== null
                  ? `Pagar ${formatPrice(totalCents)} con Mercado Pago`
                  : 'Pagar con Mercado Pago'}
          </button>
          <span className="text-center text-xs leading-relaxed text-muted-foreground">
            Reservamos tu pedido mientras pagás. Si el pago no se aprueba, se cancela solo.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-md border-0 bg-transparent text-sm font-semibold text-foreground"
          >
            Volver
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
