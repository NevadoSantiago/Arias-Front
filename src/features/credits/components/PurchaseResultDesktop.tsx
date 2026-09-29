import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** `pattern` (compra aprobada): la banda lleva la trama de mantel del prototipo. */
  band: 'plain' | 'pattern';
  icon: ReactNode;
  eyebrow: string;
  title: string;
  lead: string;
  /** Rol de la bajada: en revisión (`IN_MEDIATION`) es un aviso de estado. */
  leadRole?: 'status';
  /** Aviso bajo la bajada (línea de acreditación, de rechazo, de espera…). */
  note?: ReactNode;
  actions: ReactNode;
  /** Columna derecha: pasos (mientras `PENDING`) y comprobante. */
  aside: ReactNode;
}

const PATTERN: CSSProperties = {
  backgroundImage:
    'linear-gradient(90deg, hsl(var(--primary) / 0.16) 50%, transparent 50%), linear-gradient(hsl(var(--primary) / 0.16) 50%, transparent 50%)',
  backgroundSize: '18px 18px',
};

/**
 * Esqueleto de escritorio del resultado de una compra o pago directo (F22d,
 * prototipo `DesktopPurchaseStatus.dc.html`): banda ancha de color y, encima,
 * una tarjeta de dos columnas — estado y acciones a la izquierda; comprobante
 * (y los 3 pasos mientras está pendiente) a la derecha. Solo presentación: el
 * estado y los textos los decide `CreditsCheckoutStatus`, con la misma fuente
 * que el móvil.
 */
export function PurchaseResultDesktop({ band, icon, eyebrow, title, lead, leadRole, note, actions, aside }: Props) {
  return (
    <div data-layout="desktop" className="flex flex-col">
      <div
        aria-hidden="true"
        style={band === 'pattern' ? PATTERN : undefined}
        className={cn('h-[180px] shrink-0 border-b border-border', band === 'pattern' ? 'bg-card' : 'bg-muted')}
      />
      <div className="px-6 pb-12">
        <div className="relative mx-auto -mt-[100px] grid max-w-[1040px] grid-cols-[minmax(0,1fr)_420px] gap-12 rounded-[14px] border border-border bg-card px-11 py-10 shadow-md">
          <div data-column="status" className="flex min-w-0 flex-col gap-5">
            {icon}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">{eyebrow}</span>
              <h1 className="m-0 font-display text-[40px] font-bold leading-[1.1] text-foreground">{title}</h1>
              <p role={leadRole} className="m-0 text-base leading-normal text-muted-foreground">
                {lead}
              </p>
            </div>
            {note}
            <div className="flex flex-wrap gap-3 pt-1">{actions}</div>
          </div>
          <div data-column="details" className="flex min-w-0 flex-col gap-4">
            {aside}
          </div>
        </div>
      </div>
    </div>
  );
}
