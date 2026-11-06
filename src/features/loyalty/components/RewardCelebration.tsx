import { Cake, UtensilsCrossed } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { formatDayMonth } from '../timelineModel';
import type { LoyaltyMilestone } from '../types';

interface Props {
  milestone: LoyaltyMilestone | null;
  onClose: () => void;
  /** "Pedir con postre" / "Usar ahora": lleva al cliente a usar el premio. */
  onUse: (m: LoyaltyMilestone) => void;
}

function copyFor(m: LoyaltyMilestone): { title: string; sub: string; cta: string; usable: boolean } {
  const until = m.expiresAt ? ` Tenés hasta el ${formatDayMonth(m.expiresAt)}.` : '';
  switch (m.kind) {
    case 'DESSERT':
      return {
        title: '¡Postre de regalo!',
        sub: `Sumalo a tu próximo pedido de almuerzo.${until}`,
        cta: 'Pedir con postre',
        usable: true,
      };
    case 'LUNCH':
      return {
        title: '¡Almuerzo de regalo en tu saldo!',
        sub: 'Ya sumamos 1 almuerzo a tu saldo. Vence como el resto.',
        cta: '¡Genial!',
        usable: false,
      };
    default:
      return {
        title: `¡Ganaste ${m.percent ?? 10}% off!`,
        sub: `Para tu próxima compra de almuerzos.${until}`,
        cta: 'Usar ahora',
        usable: true,
      };
  }
}

function Badge({ m }: { m: LoyaltyMilestone }) {
  return (
    <span
      aria-hidden="true"
      className="surprise-pop flex h-16 w-16 items-center justify-center rounded-full bg-primary-deep text-primary-foreground shadow-[0_0_0_5px_#F3E2B8]"
    >
      {m.kind === 'DESSERT' && <Cake className="h-[30px] w-[30px]" strokeWidth={1.8} />}
      {m.kind === 'LUNCH' && <UtensilsCrossed className="h-8 w-8" strokeWidth={1.6} />}
      {m.kind === 'DISCOUNT' && (
        <span className="font-display text-[22px] font-black leading-none">{m.percent ?? 10}%</span>
      )}
    </span>
  );
}

/** Festejo de un premio nuevo (centrado, un único aviso por premio). */
export function RewardCelebration({ milestone, onClose, onUse }: Props) {
  const copy = milestone ? copyFor(milestone) : null;
  return (
    <Sheet open={!!milestone} onOpenChange={(next) => !next && onClose()}>
      {milestone && copy && (
        <SheetContent
          variant="dialog"
          className="max-w-[290px] items-center gap-2 rounded-[18px] px-5 pb-[18px] pt-7 text-center"
        >
          <div className="flex flex-col items-center gap-2">
            <Badge m={milestone} />
            <SheetTitle className="mt-1 text-[21px] leading-tight">{copy.title}</SheetTitle>
            <SheetDescription className="text-[13.5px] leading-snug">{copy.sub}</SheetDescription>
            <button
              type="button"
              onClick={() => (copy.usable ? onUse(milestone) : onClose())}
              className="mt-1.5 h-12 w-full cursor-pointer rounded-md border-0 bg-primary-deep font-sans text-sm font-bold uppercase tracking-[0.08em] text-primary-foreground"
            >
              {copy.cta}
            </button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
