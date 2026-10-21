import { cn } from '@/lib/utils';
import { formatAmountList } from '../howItWorksCopy';
import esperandoMesa from '@/assets/illustrations/EsperandoMesa-transparente.svg';
import chefOfrece from '@/assets/illustrations/chef-ofrece.svg';
import malabarista from '@/assets/illustrations/Malabarista-transparente.svg';

interface Props {
  /** Cantidades de almuerzos de los paquetes habilitados (incluido Sueltos), ascendentes y sin repetir. */
  packAmounts: number[];
}

/**
 * Bloque "¿Cómo funciona?" de la página de paquetes, hecho en HTML/CSS (antes
 * era una imagen JPEG). Tres pasos con ilustración decorativa; las cantidades
 * del primer paso salen del catálogo, no están escritas a mano.
 */
export function HowItWorks({ packAmounts }: Props) {
  const steps = [
    {
      image: esperandoMesa,
      title: 'Comprá tus almuerzos',
      body: `Elegí ${formatAmountList(packAmounts)}. Cuantos más comprás, menos pagás.`,
    },
    {
      image: chefOfrece,
      title: 'Elegí qué comer',
      body: 'Todos los platos del menú valen lo mismo: 1 almuerzo = 1 crédito.',
    },
    {
      image: malabarista,
      title: 'Indicá el horario y retirala',
      body: 'Elegí cuándo retirás y nosotros la tenemos lista para vos.',
    },
  ];

  return (
    <section
      aria-labelledby="como-funciona"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-2 pb-3 pt-3.5"
    >
      <div className="flex items-center gap-2.5 px-1.5">
        <span aria-hidden="true" className="flex-1 border-t border-primary" />
        <h2
          id="como-funciona"
          className="m-0 whitespace-nowrap font-display text-[19px] font-black uppercase tracking-[0.02em] text-foreground"
        >
          ¿Cómo funciona?
        </h2>
        <span aria-hidden="true" className="flex-1 border-t border-primary" />
      </div>

      <ol className="m-0 grid list-none grid-cols-3 p-0">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={cn('flex flex-col gap-1.5 px-[5px]', index > 0 && 'border-l border-primary/40')}
          >
            <div className="relative h-[92px]">
              <img
                src={step.image}
                alt=""
                aria-hidden="true"
                className="absolute bottom-0 right-0 h-[92px] w-[84px] object-contain object-right-bottom"
              />
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary font-display text-[15px] font-bold text-primary-foreground"
              >
                {index + 1}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-[5px] rounded-lg bg-background px-[5px] pb-2.5 pt-[9px] text-center">
              <h3 className="m-0 font-display text-[12px] font-extrabold uppercase leading-tight text-foreground">
                {step.title}
              </h3>
              <p className="m-0 text-[12px] leading-snug text-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
