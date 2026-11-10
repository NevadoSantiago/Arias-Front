import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { rewardText } from '../timelineModel';
import type { LoyaltyMilestone } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Dónde está el cliente: ciclo en curso, por empezar o terminado. */
  statusText: string;
  milestones: LoyaltyMilestone[];
}

const RULES: { title: string; body: string }[] = [
  {
    title: 'Tu ciclo dura 2 meses',
    body: 'Arranca el día que retirás tu primer almuerzo. Cuando termina el ciclo, la línea vuelve a cero y arranca con el próximo almuerzo que retirás.',
  },
  {
    title: 'Suma cada almuerzo que retirás',
    body: 'Cuenta cuando retirás tu pedido en el local. Los reservados o cancelados no suman.',
  },
  {
    title: 'Postre y 10% off: tenés 7 días',
    body: 'El postre lo sumás a un pedido de almuerzo (no se pide solo). El 10% off se usa una vez, en tu próxima compra de almuerzos. El almuerzo de regalo se suma a tu saldo y vence como el resto.',
  },
  {
    title: 'Un descuento por vez',
    body: 'Si ya tenías otro descuento, queda el mayor. Si son iguales, queda el que vence más tarde.',
  },
];

/** Hoja "Cómo funciona" de la línea de beneficios. Los premios salen de lo que informa el servidor. */
export function RulesSheet({ open, onClose, statusText, milestones }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="gap-4 overflow-y-auto px-5 pb-5 pt-4 lg:bottom-auto lg:top-16 lg:rounded-2xl lg:border">
        <div className="flex flex-col gap-1.5 pr-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-deep">
            Línea de beneficios
          </span>
          <SheetTitle className="text-[23px]">Cómo funciona</SheetTitle>
        </div>

        <SheetDescription className="text-sm leading-normal text-foreground">{statusText}</SheetDescription>

        <ul className="m-0 flex list-none flex-col gap-2 rounded-[10px] bg-background p-3">
          {milestones.map((m) => (
            <li key={m.lunches} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-deep text-[13px] font-bold text-primary-foreground"
              >
                {m.lunches}
              </span>
              <span className="text-sm leading-snug">
                <strong className="font-bold">{m.lunches} almuerzos:</strong> {rewardText(m)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="m-0 flex flex-col gap-3.5">
          {RULES.map((r) => (
            <div key={r.title} className="flex flex-col gap-0.5">
              <dt className="text-[14.5px] font-bold">{r.title}</dt>
              <dd className="m-0 text-[13.5px] leading-normal text-muted-foreground">{r.body}</dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="h-[52px] w-full cursor-pointer rounded-md border-0 bg-primary-deep font-sans text-sm font-bold uppercase tracking-[0.08em] text-primary-foreground"
        >
          Entendido
        </button>
      </SheetContent>
    </Sheet>
  );
}
