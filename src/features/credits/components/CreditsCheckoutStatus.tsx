import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock3, Info, ShieldAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getPurchase } from '../services/creditsApi';
import type { CreditPurchase, CreditPurchaseStatus } from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

const FAILED_STATUSES: CreditPurchaseStatus[] = ['REJECTED', 'CANCELLED', 'REVERSED', 'EXPIRED'];

interface CreditsCheckoutStatusProps {
  purchaseId: string | null;
}

function formatAmount(purchase: Pick<CreditPurchase, 'amountCents' | 'currency'>): string {
  return (purchase.amountCents / 100).toLocaleString('es-AR', { style: 'currency', currency: purchase.currency });
}

/**
 * F9: el backend informa `packNombre` (nombre real del pack comprado, p. ej.
 * "Paquete Semana"; `null` en `DIRECT` — tarea B3) y lo mostramos en vez del
 * texto genérico. Limitación conocida: para Sueltos (pack `DAY` comprado con
 * `quantity`), `packNombre` es el `nombre` del pack tal cual está en la base
 * (no dice "N almuerzos sueltos") — el DTO no expone el código del pack ni
 * `quantity`, así que no hay forma confiable de distinguir esa compra acá sin
 * inventar un campo nuevo. Se muestra el nombre tal como llega.
 */
function purchaseLabel(purchase: Pick<CreditPurchase, 'type' | 'packNombre'>): string {
  if (purchase.packNombre) return purchase.packNombre;
  return purchase.type === 'PACK' ? 'Paquete de almuerzos' : 'Compra directa';
}

/** Círculo de ícono de estado (F7, prototipo `Purchase{Pending,Approved,Rejected}.dc.html`). */
function StatusIcon({ tone, children }: { tone: 'pending' | 'success' | 'error' | 'info'; children: React.ReactNode }) {
  const toneClass: Record<typeof tone, string> = {
    pending: 'bg-warning text-foreground',
    success: 'bg-success text-primary-foreground',
    error: 'bg-destructive text-destructive-foreground',
    info: 'bg-muted text-foreground',
  };
  return (
    <div aria-hidden="true" className={cn('flex h-20 w-20 shrink-0 items-center justify-center rounded-full', toneClass[tone])}>
      {children}
    </div>
  );
}

/** Item de la lista de 3 pasos del estado "pendiente" (hecho / en curso / pendiente). */
function StepItem({ state, title, detail }: { state: 'done' | 'active' | 'upcoming'; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          state === 'done' && 'bg-success text-primary-foreground',
          state === 'active' && 'border-[3px] border-warning',
          state === 'upcoming' && 'border-2 border-dashed border-muted-foreground/60',
        )}
      >
        {state === 'done' && <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />}
        {state === 'active' && <span className="h-2.5 w-2.5 rounded-full bg-warning" />}
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className={cn('text-[14.5px]', state === 'upcoming' ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
          {title}
        </span>
        <span className="text-[12.5px] text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
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
 *
 * F7: solo se restylió la presentación (íconos, lista de 3 pasos, tarjetas)
 * per el prototipo. La lógica de polling/estado de arriba no cambió.
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
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <StatusIcon tone="error">
          <ShieldAlert className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <h1 className="font-display text-2xl font-bold leading-tight text-foreground">No pudimos identificar tu compra</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Revisá tu historial en la sección de almuerzos.</p>
        <Link
          to="/credits"
          className="flex h-[52px] w-full items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground no-underline"
        >
          Ir a mis almuerzos
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <StatusIcon tone="pending">
          <Clock3 className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <p role="status" className="text-sm text-muted-foreground">
          Verificando el estado de tu compra…
        </p>
      </div>
    );
  }

  if (isError || !purchase) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <StatusIcon tone="error">
          <X className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <h1 className="font-display text-2xl font-bold leading-tight text-foreground">No pudimos consultar tu compra</h1>
        <p role="alert" className="text-sm text-destructive">
          No pudimos consultar el estado de tu compra.
        </p>
      </div>
    );
  }

  const isDirect = purchase.type === 'DIRECT';

  if (purchase.status === 'PENDING' && gaveUp) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <StatusIcon tone="pending">
          <Clock3 className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">Estamos confirmando tu pago</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Mercado Pago puede tardar unos minutos en avisarnos. No hace falta que pagues de nuevo.
          </p>
        </div>
        <ol aria-label="Estado de la compra" className="m-0 flex w-full list-none flex-col gap-3.5 rounded-lg border border-border bg-card p-4">
          <StepItem state="done" title="Pago enviado" detail={`${purchaseLabel(purchase)} · ${formatAmount(purchase)}`} />
          <StepItem state="active" title="Confirmación de Mercado Pago" detail="Suele tardar unos segundos; a veces, unos minutos." />
          {isDirect ? (
            <StepItem state="upcoming" title="Tu pedido queda programado" detail="Se confirma solo, sin que hagas nada." />
          ) : (
            <StepItem state="upcoming" title="Almuerzos en tu saldo" detail="Se suman solos, sin que hagas nada." />
          )}
        </ol>
        <p role="status" className="text-sm text-muted-foreground">
          Tu pago está demorando más de lo esperado. Te avisamos por correo apenas se acredite.
        </p>
      </div>
    );
  }

  if (purchase.status === 'PENDING') {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <StatusIcon tone="pending">
          <Clock3 className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">Estamos confirmando tu pago</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Mercado Pago puede tardar unos minutos en avisarnos. No hace falta que pagues de nuevo.
          </p>
        </div>
        <ol aria-label="Estado de la compra" className="m-0 flex w-full list-none flex-col gap-3.5 rounded-lg border border-border bg-card p-4">
          <StepItem state="done" title="Pago enviado" detail={`${purchaseLabel(purchase)} · ${formatAmount(purchase)}`} />
          <StepItem state="active" title="Confirmación de Mercado Pago" detail="Suele tardar unos segundos; a veces, unos minutos." />
          {isDirect ? (
            <StepItem state="upcoming" title="Tu pedido queda programado" detail="Se confirma solo, sin que hagas nada." />
          ) : (
            <StepItem state="upcoming" title="Almuerzos en tu saldo" detail="Se suman solos, sin que hagas nada." />
          )}
        </ol>
        <p role="status" className="text-sm text-muted-foreground">
          Estamos procesando tu pago…
        </p>
      </div>
    );
  }

  if (purchase.status === 'APPROVED') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <StatusIcon tone="success">
          <Check className="h-10 w-10" aria-hidden="true" strokeWidth={2.4} />
        </StatusIcon>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">
            {isDirect ? '¡Listo! Tu pedido quedó programado' : `¡Listo! Sumaste ${purchase.creditAmount} almuerzos`}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">Mercado Pago confirmó el pago y ya podés usarlos.</p>
        </div>
        <dl className="m-0 flex w-full flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-left">
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Compra</dt>
            <dd className="m-0 font-semibold text-foreground">{purchaseLabel(purchase)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Almuerzos</dt>
            <dd className="m-0 font-semibold text-foreground">{purchase.creditAmount}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Total pagado</dt>
            <dd className="m-0 font-semibold text-foreground">{formatAmount(purchase)}</dd>
          </div>
        </dl>
        <p role="status" className="text-sm text-foreground">
          ¡Listo! Se acreditaron {purchase.creditAmount} almuerzos en tu billetera.
        </p>
        <div className="flex w-full flex-col gap-2.5">
          {isDirect ? (
            <Link
              to="/orders/mine"
              className="flex h-[52px] items-center justify-center rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
            >
              Ver mi pedido
            </Link>
          ) : (
            <Link
              to="/orders/today"
              className="flex h-[52px] items-center justify-center rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
            >
              Pedir mi almuerzo
            </Link>
          )}
          <Link
            to="/credits"
            className="flex h-[52px] items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground no-underline"
          >
            Ver mis almuerzos
          </Link>
        </div>
      </div>
    );
  }

  if (purchase.status === 'IN_MEDIATION') {
    // F11 (prototipo `PurchaseMediation.dc.html`). Decisión del usuario
    // (2026-09-26): sin promesa de aviso por correo. El copy depende de
    // `creditedAt`: si es `null`, la compra nunca se acreditó y los
    // almuerzos quedan en espera; si tiene valor, se acreditó ANTES de la
    // disputa y esos almuerzos siguen en el saldo mientras se resuelve.
    const holdCopy = purchase.creditedAt
      ? `Los ${purchase.creditAmount} almuerzos de esta compra siguen en tu saldo mientras Mercado Pago lo revisa.`
      : `Los ${purchase.creditAmount} almuerzos de esta compra quedan en espera hasta que se resuelva.`;

    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <StatusIcon tone="info">
          <Info className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">Tu pago está en revisión</h1>
          <p role="status" className="text-sm leading-relaxed text-muted-foreground">
            Se abrió un reclamo sobre este pago y Mercado Pago lo está revisando. No tenés que hacer nada desde
            Arias.
          </p>
        </div>
        <dl className="m-0 flex w-full flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-left">
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Compra</dt>
            <dd className="m-0 font-semibold text-foreground">{purchaseLabel(purchase)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Almuerzos</dt>
            <dd className="m-0 font-semibold text-foreground">{purchase.creditAmount}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="m-0 font-semibold text-foreground">{formatAmount(purchase)}</dd>
          </div>
          <div aria-hidden="true" className="border-t border-dashed border-border" />
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="m-0 font-bold text-foreground">En revisión por Mercado Pago</dd>
          </div>
        </dl>
        <p className="text-sm leading-relaxed text-foreground">{holdCopy}</p>
        <div className="flex w-full flex-col gap-2.5">
          <Link
            to="/credits"
            className="flex h-[52px] items-center justify-center rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
          >
            Volver a mis almuerzos
          </Link>
          <Link
            to="/orders/today"
            className="flex h-[52px] items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground no-underline"
          >
            Ir al menú
          </Link>
        </div>
      </div>
    );
  }

  if (FAILED_STATUSES.includes(purchase.status)) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <StatusIcon tone="error">
          <X className="h-9 w-9" aria-hidden="true" strokeWidth={2.4} />
        </StatusIcon>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">
            {isDirect ? 'No se aprobó el pago. Tu pedido se canceló' : 'No se pudo completar el pago'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isDirect
              ? 'El pedido se canceló y el stock reservado se liberó. Podés volver a pedir cuando quieras.'
              : 'No se acreditó ningún almuerzo. Podés intentarlo de nuevo con el mismo u otro medio de pago.'}
          </p>
        </div>
        <dl className="m-0 flex w-full flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-left">
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Compra</dt>
            <dd className="m-0 font-semibold text-foreground">{purchaseLabel(purchase)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="m-0 font-semibold text-foreground">{formatAmount(purchase)}</dd>
          </div>
          <div aria-hidden="true" className="border-t border-dashed border-border" />
          <div className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="m-0 font-bold text-destructive">Rechazado</dd>
          </div>
        </dl>
        <p role="alert" className="text-sm text-destructive">
          {isDirect
            ? 'No se aprobó el pago. Tu pedido se canceló.'
            : 'El pago no se pudo completar. No se acreditó ningún almuerzo.'}
        </p>
        <div className="flex w-full flex-col gap-2.5">
          {isDirect ? (
            <Link
              to="/orders/today"
              className="flex h-[52px] items-center justify-center rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
            >
              Volver a pedir
            </Link>
          ) : (
            <Link
              to="/credits/packs"
              className="flex h-[52px] items-center justify-center rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
            >
              Intentar de nuevo
            </Link>
          )}
          <Link
            to="/credits"
            className="flex h-[52px] items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground no-underline"
          >
            Volver a mis almuerzos
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
