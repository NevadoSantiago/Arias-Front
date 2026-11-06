import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/features/credits/hooks/useWallet';
import { activeAccountDiscount } from '@/features/credits/packPricing';
import { useLoyalty } from '../hooks/useLoyalty';
import { useFillAnimation } from '../hooks/useFillAnimation';
import { rememberCelebrated, wasCelebrated } from '../loyaltyStorage';
import { daysUntil, formatDayMonth, isInFuture, rewardTitle, statusFor } from '../timelineModel';
import type { LoyaltyEnabled, LoyaltyMilestone } from '../types';
import { BenefitsTimeline, type RewardChip } from './BenefitsTimeline';
import { RewardCelebration } from './RewardCelebration';
import { RulesSheet } from './RulesSheet';

const BUY_PATH = '/credits?comprar=1';

const STATUS_WORD = { locked: 'bloqueado', ready: 'listo para usar', done: 'conseguido', expired: 'vencido' } as const;

interface Props {
  userId: number;
  /**
   * El cliente quiere usar su postre de regalo (chip, marcador o festejo).
   * Hoy lleva al menú del pedido; el canje del postre cuelga de acá.
   */
  onUseDessert: () => void;
}

/**
 * Línea de beneficios del inicio. No muestra nada si la función está apagada
 * para el usuario o si el pedido falla: nunca debe romper el inicio.
 */
export function LoyaltySection({ userId, onUseDessert }: Props) {
  const { data } = useLoyalty();
  if (!data || !data.enabled) return null;
  return <LoyaltyContent userId={userId} loyalty={data} onUseDessert={onUseDessert} />;
}

function celebrationKeyOf(loyalty: LoyaltyEnabled, m: LoyaltyMilestone): string {
  return `${m.kind}:${m.lunches}:${loyalty.cycle?.startedAt ?? ''}`;
}

/** Premios que merecen festejo: el postre y el descuento ganados, y el almuerzo ya sumado al saldo. */
function celebratable(m: LoyaltyMilestone): boolean {
  if (m.kind === 'LUNCH') return m.status === 'EARNED' || m.status === 'USED';
  return m.status === 'EARNED';
}

function LoyaltyContent({
  userId, loyalty, onUseDessert,
}: { userId: number; loyalty: LoyaltyEnabled; onUseDessert: () => void }) {
  const navigate = useNavigate();
  const { data: wallet } = useWallet();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { cycle, waiting } = loyalty;
  const milestones = useMemo(
    () => [...loyalty.milestones].sort((a, b) => a.lunches - b.lunches),
    [loyalty.milestones],
  );
  const { value, done } = useFillAnimation(cycle?.lunches ?? 0);

  // Cada premio se festeja una sola vez, cuando la línea ya llegó a su marcador.
  const celebrating = done && cycle
    ? milestones.find(
      (m) => celebratable(m)
        && !dismissed.includes(celebrationKeyOf(loyalty, m))
        && !wasCelebrated(userId, celebrationKeyOf(loyalty, m)),
    ) ?? null
    : null;

  const closeCelebration = () => {
    if (!celebrating) return;
    const key = celebrationKeyOf(loyalty, celebrating);
    rememberCelebrated(userId, key);
    setDismissed((d) => [...d, key]);
  };

  const applyReward = (kind: LoyaltyMilestone['kind']) => {
    if (kind === 'DESSERT') onUseDessert();
    else if (kind === 'DISCOUNT') navigate(BUY_PATH);
  };

  const chips: RewardChip[] = [];
  if (loyalty.pendingDessert && isInFuture(loyalty.pendingDessert.expiresAt)) {
    chips.push({
      key: 'dessert',
      kind: 'DESSERT',
      title: 'Postre de regalo',
      daysLeft: daysUntil(loyalty.pendingDessert.expiresAt),
      onUse: onUseDessert,
    });
  }
  const discount = activeAccountDiscount(wallet?.discount);
  if (discount && discount.source === 'LOYALTY') {
    chips.push({
      key: 'discount',
      kind: 'DISCOUNT',
      title: `${discount.percent}% off`,
      daysLeft: daysUntil(discount.expiresAt),
      onUse: () => navigate(BUY_PATH),
    });
  }

  let caption: string | null = null;
  if (!cycle) {
    caption = waiting
      ? 'Tu ciclo terminó. El próximo arranca con tu próximo almuerzo.'
      : 'Tu ciclo arranca con tu primer almuerzo.';
  }

  const lunchesDone = cycle?.lunches ?? 0;
  let statusText: string;
  if (cycle) {
    statusText = `Tu ciclo va del ${formatDayMonth(cycle.startedAt)} al ${formatDayMonth(cycle.endsAt)}. `
      + `Llevás ${lunchesDone} ${lunchesDone === 1 ? 'almuerzo' : 'almuerzos'}.`;
  } else if (waiting) {
    statusText = 'Tu último ciclo terminó. El próximo arranca con el próximo almuerzo que retirás.';
  } else {
    statusText = 'Tu ciclo arranca el día que retirás tu primer almuerzo.';
  }

  const milestonesLabel = milestones
    .map((m) => `${rewardTitle(m)} a los ${m.lunches}: ${STATUS_WORD[statusFor(m, !!cycle)]}`)
    .join('. ');
  const lineLabel = (cycle
    ? `Tu ciclo del ${formatDayMonth(cycle.startedAt)} al ${formatDayMonth(cycle.endsAt)}: ${lunchesDone} almuerzos retirados. `
    : `${caption} `) + `${milestonesLabel}. Ver cómo funciona`;

  return (
    <>
      <BenefitsTimeline
        cycle={cycle}
        lunches={cycle ? value : 0}
        milestones={milestones}
        chips={chips}
        caption={caption}
        lineLabel={lineLabel}
        onOpenRules={() => setRulesOpen(true)}
        onActivate={(m) => applyReward(m.kind)}
      />
      <RulesSheet
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        statusText={statusText}
        milestones={milestones}
      />
      <RewardCelebration
        milestone={celebrating}
        onClose={closeCelebration}
        onUse={(m) => {
          closeCelebration();
          applyReward(m.kind);
        }}
      />
    </>
  );
}
