import panero from '@/assets/illustrations/Panero-transparente.svg';
import conBandeja from '@/assets/illustrations/ConBandeja-transparente.svg';
import esperandoMesa from '@/assets/illustrations/EsperandoMesa-transparente.svg';
import chef from '@/assets/illustrations/Chef-transparente.svg';
import malabarista from '@/assets/illustrations/Malabarista-transparente.svg';
import { dailyIllustrationIndex } from './dailyIllustration';

const ILLUSTRATIONS = [panero, conBandeja, esperandoMesa, chef, malabarista];

interface Props {
  /** El día que decide la ilustración; por defecto hoy. */
  date?: Date;
}

/**
 * Ilustración decorativa bajo el panel "Tu pedido" de escritorio: cambia por
 * día entre cinco (`dailyIllustrationIndex`), sin fondo, centrada y de 280px
 * de alto (el ancho sale de su proporción, sin pasar el de la columna).
 */
export function OrderDayIllustration({ date }: Props) {
  const src = ILLUSTRATIONS[dailyIllustrationIndex(date ?? new Date(), ILLUSTRATIONS.length)];
  return (
    <img
      data-testid="daily-illustration"
      src={src}
      alt=""
      aria-hidden="true"
      className="pointer-events-none mx-auto h-[280px] w-auto max-w-full select-none object-contain"
    />
  );
}
