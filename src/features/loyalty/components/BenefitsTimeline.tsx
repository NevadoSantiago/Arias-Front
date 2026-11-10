import { Check, Dessert, Tag, UtensilsCrossed, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expiryText, formatDayMonth, positionFor, rewardTitle, statusFor, type NodeStatus } from '../timelineModel';
import type { LoyaltyCycle, LoyaltyMilestone } from '../types';

export interface RewardChip {
  key: string;
  kind: 'DESSERT' | 'DISCOUNT';
  title: string;
  /** Días de calendario que faltan para que venza. */
  daysLeft: number;
  onUse: () => void;
}

interface Props {
  cycle: LoyaltyCycle | null;
  /** Almuerzos mostrados (animados). */
  lunches: number;
  milestones: LoyaltyMilestone[];
  chips: RewardChip[];
  caption: string | null;
  lineLabel: string;
  onOpenRules: () => void;
  onActivate: (m: LoyaltyMilestone) => void;
}

const DOT_BASE =
  'relative flex h-[30px] w-[30px] items-center justify-center rounded-full text-[9.5px] font-bold tracking-tight transition-[background-color,box-shadow,color] duration-300';

const DOT_LOOK: Record<NodeStatus, string> = {
  locked: 'border-[1.5px] border-border bg-muted text-muted-foreground',
  ready: 'bg-primary-deep text-primary-foreground shadow-[0_0_0_3px_#F3E2B8]',
  done: 'border-[1.5px] border-primary-deep bg-card text-primary-deep',
  expired: 'border-[1.5px] border-dashed border-[#9C8B84] bg-muted text-muted-foreground',
};

function MilestoneIcon({ m }: { m: LoyaltyMilestone }) {
  if (m.kind === 'DESSERT') return <Dessert className="h-4 w-4" strokeWidth={2} aria-hidden="true" />;
  if (m.kind === 'LUNCH') return <UtensilsCrossed className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden="true" />;
  return <span aria-hidden="true">{m.percent ?? 10}%</span>;
}

function Dot({ m, status }: { m: LoyaltyMilestone; status: NodeStatus }) {
  return (
    <span aria-hidden="true" className={cn(DOT_BASE, DOT_LOOK[status])}>
      <MilestoneIcon m={m} />
      {status === 'done' && (
        <span className="absolute -bottom-1 -right-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border-[1.5px] border-card bg-success text-primary-foreground">
          <Check className="h-[9px] w-[9px]" strokeWidth={4} />
        </span>
      )}
      {status === 'expired' && (
        <span className="absolute -bottom-1 -right-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border-[1.5px] border-card bg-muted-foreground text-primary-foreground">
          <X className="h-2 w-2" strokeWidth={4} />
        </span>
      )}
    </span>
  );
}

/**
 * Línea de beneficios del inicio: una línea simple con las fechas del ciclo en
 * los extremos, el contador de almuerzos y un marcador por premio en posiciones
 * fijas (no proporcionales). Tocar la línea abre "Cómo funciona".
 */
export function BenefitsTimeline({
  cycle, lunches, milestones, chips, caption, lineLabel, onOpenRules, onActivate,
}: Props) {
  const thresholds = milestones.map((m) => m.lunches);
  const fillPct = positionFor(lunches, thresholds);
  const cycleActive = !!cycle;

  return (
    <section aria-label="Línea de beneficios" className="mb-6 flex flex-col items-start gap-2">
      <div className="flex items-start gap-1.5 self-stretch rounded-2xl border border-border bg-card px-3 py-1.5">
        <span className="mt-[25px] shrink-0 text-[11px] font-semibold leading-[14px] text-muted-foreground">
          {cycle ? formatDayMonth(cycle.startedAt) : 'Inicio'}
        </span>
        <div className="relative h-[66px] min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenRules}
            aria-label={lineLabel}
            className="absolute inset-0 h-full w-full cursor-pointer rounded-md border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          />
          <div className="pointer-events-none absolute inset-y-0 left-[18px] right-[18px]">
            <div className="absolute inset-x-0 top-[30px] h-1 rounded-full bg-[#E3D6BF]" />
            <div
              data-testid="loyalty-fill"
              className="absolute left-0 top-[30px] h-1 rounded-full bg-primary-deep"
              style={{ width: `${fillPct}%` }}
            />
            {cycleActive && (
              <span
                data-testid="loyalty-count"
                aria-hidden="true"
                className="absolute top-0 h-4 min-w-[18px] -translate-x-1/2 rounded-full bg-primary-deep px-[5px] text-center text-[10px] font-bold leading-4 text-primary-foreground"
                style={{ left: `${fillPct}%` }}
              >
                {Math.floor(lunches + 0.0001)}
              </span>
            )}
            {milestones.map((m) => (
              <span
                key={`at-${m.lunches}`}
                data-testid={`loyalty-label-${m.lunches}`}
                aria-hidden="true"
                className="absolute top-[50px] -ml-3 w-6 text-center text-[10px] font-semibold leading-3 text-muted-foreground"
                style={{ left: `${positionFor(m.lunches, thresholds)}%` }}
              >
                {m.lunches}
              </span>
            ))}
            {milestones.map((m) => {
              // Un marcador se enciende recién cuando el relleno lo alcanza.
              const lit = lunches >= m.lunches - 0.0001;
              const status = lit ? statusFor(m, cycleActive) : 'locked';
              return (
                <span
                  key={`node-${m.lunches}`}
                  data-testid={`loyalty-node-${m.lunches}`}
                  data-status={status}
                  className="absolute top-[10px] -ml-[22px] flex h-11 w-11 items-center justify-center"
                  style={{ left: `${positionFor(m.lunches, thresholds)}%` }}
                >
                  {status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => onActivate(m)}
                      aria-label={`${rewardTitle(m)} listo para usar. Usarlo`}
                      className="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 font-sans"
                    >
                      <Dot m={m} status={status} />
                    </button>
                  ) : (
                    <Dot m={m} status={status} />
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <span className="mt-[25px] shrink-0 text-[11px] font-semibold leading-[14px] text-muted-foreground">
          {cycle ? formatDayMonth(cycle.endsAt) : '+2 meses'}
        </span>
      </div>

      {caption && <p className="m-0 px-1 text-[13px] leading-snug text-muted-foreground">{caption}</p>}

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onUse}
          className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-primary-deep bg-[#FBF7EF] pl-2.5 pr-3.5 font-sans text-[13px] text-foreground"
        >
          {chip.kind === 'DESSERT' ? (
            <Dessert className="h-4 w-4 text-primary-deep" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Tag className="h-4 w-4 text-primary-deep" strokeWidth={2} aria-hidden="true" />
          )}
          <strong className="font-bold">{chip.title}</strong>{' '}
          <span className={chip.daysLeft <= 1 ? 'font-bold text-warning-deep' : 'text-muted-foreground'}>
            · {expiryText(chip.daysLeft)}
          </span>{' '}
          <span className="font-bold text-primary-deep">· Usar</span>
        </button>
      ))}
    </section>
  );
}
