import chefOfrece from '@/assets/illustrations/chef-ofrece.svg';
import panero from '@/assets/illustrations/Panero-transparente.svg';
import bienvenidaDE from '@/assets/illustrations/BienvenidaDE.svg';
import bienvenidaIZ from '@/assets/illustrations/BienvenidaIZ.svg';
import bienvenidaHermanos from '@/assets/illustrations/BienvenidaHermanos.svg';
import malabarista from '@/assets/illustrations/Malabarista-transparente.svg';
import panaderoDuda from '@/assets/illustrations/Panadero-Duda.svg';
import chef from '@/assets/illustrations/Chef-transparente.svg';
import conBandeja from '@/assets/illustrations/ConBandeja-transparente.svg';
import esperandoMesa from '@/assets/illustrations/EsperandoMesa-transparente.svg';
import pedidoConfirmado from '@/assets/illustrations/PedidoConfirmado-transparente.svg';
import type { TourGuide } from './tourSteps';

/** `face`: hacia dónde mira el dibujo original; `none` se ve igual espejado o no. */
export const GUIDES: Record<TourGuide, { src: string; face: 'left' | 'right' | 'none' }> = {
  ofrece: { src: chefOfrece, face: 'right' },
  panero: { src: panero, face: 'left' },
  de: { src: bienvenidaDE, face: 'left' },
  malabarista: { src: malabarista, face: 'none' },
  duda: { src: panaderoDuda, face: 'left' },
  chef: { src: chef, face: 'left' },
  bandeja: { src: conBandeja, face: 'left' },
  esperando: { src: esperandoMesa, face: 'left' },
  iz: { src: bienvenidaIZ, face: 'right' },
};

export const WELCOME_ILLUSTRATION = bienvenidaHermanos;
export const FINAL_ILLUSTRATION = pedidoConfirmado;
