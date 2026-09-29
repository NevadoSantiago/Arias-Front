import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock3, Info, ShieldAlert, X, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { getPurchase } from '../services/creditsApi';
import type { CreditPurchase, CreditPurchaseStatus } from '../types';
import { PurchaseResultDesktop } from './PurchaseResultDesktop';

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

type Tone = 'pending' | 'success' | 'error' | 'info';

/** Círculo de ícono de estado (F7, prototipo `Purchase{Pending,Approved,Rejected}.dc.html`). */
function StatusIcon({ tone, large, children }: { tone: Tone; large?: boolean; children: React.ReactNode }) {
  const toneClass: Record<Tone, string> = {
    pending: 'bg-warning text-foreground',
    success: 'bg-success text-primary-foreground',
    error: 'bg-destructive text-destructive-foreground',
    info: 'bg-muted text-foreground',
  };
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        large ? 'h-[88px] w-[88px]' : 'h-20 w-20',
        toneClass[tone],
      )}
    >
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

/** Los 3 pasos del pago pendiente; el último cambia si es un pago directo (pedido) o una compra de almuerzos. */
function PendingSteps({ purchase, isDirect, wide }: { purchase: CreditPurchase; isDirect: boolean; wide: boolean }) {
  return (
    <ol
      aria-label="Estado de la compra"
      className={cn(
        'm-0 flex list-none flex-col border border-border',
        wide ? 'gap-4 rounded-[10px] bg-background/40 p-[18px]' : 'w-full gap-3.5 rounded-lg bg-card p-4',
      )}
    >
      <StepItem state="done" title="Pago enviado" detail={`${purchaseLabel(purchase)} · ${formatAmount(purchase)}`} />
      <StepItem state="active" title="Confirmación de Mercado Pago" detail="Suele tardar unos segundos; a veces, unos minutos." />
      {isDirect ? (
        <StepItem state="upcoming" title="Tu pedido queda programado" detail="Se confirma solo, sin que hagas nada." />
      ) : (
        <StepItem state="upcoming" title="Almuerzos en tu saldo" detail="Se suman solos, sin que hagas nada." />
      )}
    </ol>
  );
}

type ReceiptRow = { k: string; v: string; tone?: 'strong' | 'danger' } | 'rule';

const VALUE_CLASS = {
  default: 'm-0 font-semibold text-foreground',
  strong: 'm-0 font-bold text-foreground',
  danger: 'm-0 font-bold text-destructive',
};

/** Comprobante de la compra (compra, almuerzos, total, estado). */
function Receipt({ rows, wide }: { rows: ReceiptRow[]; wide: boolean }) {
  return (
    <dl
      className={cn(
        'm-0 flex flex-col gap-2.5 border border-border',
        wide ? 'rounded-[10px] bg-background/40 p-[18px]' : 'w-full rounded-lg bg-card p-4 text-left',
      )}
    >
      {rows.map((row, i) =>
        row === 'rule' ? (
          <div key={i} aria-hidden="true" className="border-t border-dashed border-border" />
        ) : (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{row.k}</dt>
            <dd className={VALUE_CLASS[row.tone ?? 'default']}>{row.v}</dd>
          </div>
        ),
      )}
    </dl>
  );
}

interface Cta {
  to: string;
  label: string;
}

function CtaLink({ cta, kind, wide }: { cta: Cta; kind: 'primary' | 'secondary'; wide: boolean }) {
  const className = wide
    ? kind === 'primary'
      ? 'flex h-[54px] items-center rounded-md bg-primary-deep px-6 text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline'
      : 'flex h-[54px] items-center rounded-md border-[1.5px] border-border bg-background/40 px-[22px] text-sm font-semibold text-foreground no-underline'
    : kind === 'primary'
      ? 'flex h-[52px] items-center justify-center rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline'
      : 'flex h-[52px] items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground no-underline';
  return (
    <Link to={cta.to} className={className}>
      {cta.label}
    </Link>
  );
}

/**
 * Todo lo que cambia entre estados (textos, ícono, comprobante, acciones),
 * decidido en un solo lugar y con la misma fuente para móvil y escritorio
 * (F22d): solo cambia el marco que lo dibuja.
 */
interface ResultView {
  tone: Tone;
  Icon: LucideIcon;
  /** Tamaño del ícono en móvil (en escritorio siempre 40px). */
  iconClass: string;
  iconStroke?: number;
  eyebrow: string;
  title: string;
  lead: string;
  leadRole?: 'status';
  pending: boolean;
  /** Comprobante; en `PENDING` el móvil no lo muestra (solo los pasos), el escritorio sí. */
  rows: ReceiptRow[];
  showRowsOnMobile: boolean;
  note: { text: string; role?: 'status' | 'alert'; className: string; highlight?: boolean };
  primary?: Cta;
  secondary: Cta;
  /** Separación vertical del bloque en móvil. */
  rootClass: string;
}

function buildView(purchase: CreditPurchase, isDirect: boolean, gaveUp: boolean): ResultView | null {
  const label = purchaseLabel(purchase);
  const eyebrow = isDirect ? 'Pago de tu pedido' : 'Compra de almuerzos';
  const gap4 = 'flex flex-col items-center gap-4 py-6 text-center';
  // Pago parcial (F23): una compra DIRECT cubre solo lo que cobra Mercado Pago
  // (`creditAmount` y `amountCents` ya son el resto), así que se rotula como tal.
  const lunchesRowLabel = isDirect ? 'Almuerzos con Mercado Pago' : 'Almuerzos';

  if (purchase.status === 'PENDING') {
    return {
      tone: 'pending',
      Icon: Clock3,
      iconClass: 'h-9 w-9',
      eyebrow,
      title: 'Estamos confirmando tu pago',
      lead: 'Mercado Pago puede tardar unos minutos en avisarnos. No hace falta que pagues de nuevo.',
      pending: true,
      rows: [
        { k: 'Compra', v: label },
        { k: lunchesRowLabel, v: String(purchase.creditAmount) },
        { k: 'Total', v: formatAmount(purchase) },
      ],
      showRowsOnMobile: false,
      note: {
        text: gaveUp
          ? 'Tu pago está demorando más de lo esperado. Te avisamos por correo apenas se acredite.'
          : 'Estamos procesando tu pago…',
        role: 'status',
        className: 'text-sm text-muted-foreground',
      },
      // Solo escritorio: el móvil no tiene acciones mientras se confirma.
      secondary: isDirect
        ? { to: '/orders/mine', label: 'Ver mis pedidos' }
        : { to: '/credits', label: 'Volver a mis almuerzos' },
      rootClass: 'flex flex-col items-center gap-5 py-6 text-center',
    };
  }

  if (purchase.status === 'APPROVED') {
    return {
      tone: 'success',
      Icon: Check,
      iconClass: 'h-10 w-10',
      iconStroke: 2.4,
      eyebrow,
      title: isDirect ? '¡Listo! Tu pedido quedó programado' : `¡Listo! Sumaste ${purchase.creditAmount} almuerzos`,
      lead: isDirect
        ? 'Mercado Pago confirmó el pago. Tu pedido quedó programado.'
        : 'Mercado Pago confirmó el pago y ya podés usarlos.',
      pending: false,
      rows: [
        { k: 'Compra', v: label },
        { k: lunchesRowLabel, v: String(purchase.creditAmount) },
        { k: 'Total pagado', v: formatAmount(purchase) },
      ],
      showRowsOnMobile: true,
      // Un pago directo no acredita almuerzos: no hay línea de acreditación (F18.1).
      note: {
        text: isDirect ? '' : `¡Listo! Se acreditaron ${purchase.creditAmount} almuerzos en tu billetera.`,
        role: 'status',
        className: 'text-sm text-foreground',
        highlight: true,
      },
      primary: isDirect ? { to: '/orders/mine', label: 'Ver mi pedido' } : { to: '/orders/today', label: 'Pedir mi almuerzo' },
      secondary: { to: '/credits', label: 'Ver mis almuerzos' },
      rootClass: gap4,
    };
  }

  if (purchase.status === 'IN_MEDIATION') {
    // F11 (prototipo `PurchaseMediation.dc.html`). Decisión del usuario
    // (2026-09-26): sin promesa de aviso por correo. El copy depende de
    // `creditedAt`: si es `null`, la compra nunca se acreditó y los
    // almuerzos quedan en espera; si tiene valor, se acreditó ANTES de la
    // disputa y esos almuerzos siguen en el saldo mientras se resuelve.
    return {
      tone: 'info',
      Icon: Info,
      iconClass: 'h-9 w-9',
      eyebrow,
      title: 'Tu pago está en revisión',
      lead: 'Se abrió un reclamo sobre este pago y Mercado Pago lo está revisando. No tenés que hacer nada desde Arias.',
      leadRole: 'status',
      pending: false,
      rows: [
        { k: 'Compra', v: label },
        { k: 'Almuerzos', v: String(purchase.creditAmount) },
        { k: 'Total', v: formatAmount(purchase) },
        'rule',
        { k: 'Estado', v: 'En revisión por Mercado Pago', tone: 'strong' },
      ],
      showRowsOnMobile: true,
      note: {
        text: purchase.creditedAt
          ? `Los ${purchase.creditAmount} almuerzos de esta compra siguen en tu saldo mientras Mercado Pago lo revisa.`
          : `Los ${purchase.creditAmount} almuerzos de esta compra quedan en espera hasta que se resuelva.`,
        className: 'text-sm leading-relaxed text-foreground',
      },
      primary: { to: '/credits', label: 'Volver a mis almuerzos' },
      secondary: { to: '/orders/today', label: 'Ir al menú' },
      rootClass: gap4,
    };
  }

  if (FAILED_STATUSES.includes(purchase.status)) {
    return {
      tone: 'error',
      Icon: X,
      iconClass: 'h-9 w-9',
      iconStroke: 2.4,
      eyebrow,
      title: isDirect ? 'No se aprobó el pago. Tu pedido se canceló' : 'No se pudo completar el pago',
      lead: isDirect
        ? 'El pedido se canceló y el stock reservado se liberó. Podés volver a pedir cuando quieras.'
        : 'No se acreditó ningún almuerzo. Podés intentarlo de nuevo con el mismo u otro medio de pago.',
      pending: false,
      rows: [
        { k: 'Compra', v: label },
        { k: 'Total', v: formatAmount(purchase) },
        'rule',
        { k: 'Estado', v: 'Rechazado', tone: 'danger' },
      ],
      showRowsOnMobile: true,
      note: {
        text: isDirect
          ? 'No se aprobó el pago. Tu pedido se canceló.'
          : 'El pago no se pudo completar. No se acreditó ningún almuerzo.',
        role: 'alert',
        className: 'text-sm text-destructive',
      },
      primary: isDirect
        ? { to: '/orders/today', label: 'Volver a pedir' }
        : { to: '/credits/packs', label: 'Intentar de nuevo' },
      secondary: { to: '/credits', label: 'Volver a mis almuerzos' },
      rootClass: gap4,
    };
  }

  return null;
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
 *
 * F22d: en escritorio (`lg`) el mismo contenido se dibuja en dos columnas
 * (`PurchaseResultDesktop`); el móvil no cambia. "Actualizar estado" solo
 * vuelve a consultar la misma compra.
 */
export function CreditsCheckoutStatus({ purchaseId }: CreditsCheckoutStatusProps) {
  const [attempts, setAttempts] = useState(0);
  const gaveUp = attempts >= MAX_POLL_ATTEMPTS;
  const wide = useIsDesktop();

  const { data: purchase, isLoading, isError, isFetching, refetch } = useQuery({
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

  // En escritorio la página no envuelve el componente (la banda ocupa todo el
  // ancho): los estados sin banda quedan acá en una columna angosta.
  const narrow = (node: React.ReactNode) => (wide ? <div className="container max-w-md py-8">{node}</div> : node);

  if (!purchaseId) {
    return narrow(
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
      </div>,
    );
  }

  if (isLoading) {
    return narrow(
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <StatusIcon tone="pending">
          <Clock3 className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <p role="status" className="text-sm text-muted-foreground">
          Verificando el estado de tu compra…
        </p>
      </div>,
    );
  }

  if (isError || !purchase) {
    return narrow(
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <StatusIcon tone="error">
          <X className="h-9 w-9" aria-hidden="true" />
        </StatusIcon>
        <h1 className="font-display text-2xl font-bold leading-tight text-foreground">No pudimos consultar tu compra</h1>
        <p role="alert" className="text-sm text-destructive">
          No pudimos consultar el estado de tu compra.
        </p>
      </div>,
    );
  }

  const isDirect = purchase.type === 'DIRECT';
  const view = buildView(purchase, isDirect, gaveUp);
  if (!view) return null;

  const { Icon, note } = view;
  const noteNode = note.text ? (
    <p role={note.role} className={note.className}>
      {note.text}
    </p>
  ) : null;

  if (wide) {
    const actions = (
      <>
        {view.pending && (
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="h-[54px] rounded-md border-0 bg-primary-deep px-[26px] text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
          >
            Actualizar estado
          </button>
        )}
        {view.primary && <CtaLink cta={view.primary} kind="primary" wide />}
        <CtaLink cta={view.secondary} kind="secondary" wide />
      </>
    );

    return (
      <PurchaseResultDesktop
        band={purchase.status === 'APPROVED' ? 'pattern' : 'plain'}
        icon={
          <StatusIcon tone={view.tone} large>
            <Icon className="h-10 w-10" aria-hidden="true" strokeWidth={view.iconStroke} />
          </StatusIcon>
        }
        eyebrow={view.eyebrow}
        title={view.title}
        lead={view.lead}
        leadRole={view.leadRole}
        note={
          noteNode &&
          (note.highlight ? (
            <div role={note.role} className="flex items-center gap-3.5 rounded-[10px] bg-foreground px-4 py-3.5 text-background">
              <span className="text-base font-bold">{note.text}</span>
            </div>
          ) : (
            noteNode
          ))
        }
        actions={actions}
        aside={
          <>
            {view.pending && <PendingSteps purchase={purchase} isDirect={isDirect} wide />}
            <Receipt rows={view.rows} wide />
          </>
        }
      />
    );
  }

  return (
    <div className={view.rootClass}>
      <StatusIcon tone={view.tone}>
        <Icon className={view.iconClass} aria-hidden="true" strokeWidth={view.iconStroke} />
      </StatusIcon>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold leading-tight text-foreground">{view.title}</h1>
        <p role={view.leadRole} className="text-sm leading-relaxed text-muted-foreground">
          {view.lead}
        </p>
      </div>
      {view.pending && <PendingSteps purchase={purchase} isDirect={isDirect} wide={false} />}
      {view.showRowsOnMobile && <Receipt rows={view.rows} wide={false} />}
      {noteNode}
      {view.primary && (
        <div className="flex w-full flex-col gap-2.5">
          <CtaLink cta={view.primary} kind="primary" wide={false} />
          <CtaLink cta={view.secondary} kind="secondary" wide={false} />
        </div>
      )}
    </div>
  );
}
