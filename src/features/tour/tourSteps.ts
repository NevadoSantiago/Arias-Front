/**
 * Guion del tour de primer ingreso (prototipo aprobado, `Main.dc.html`). Es
 * puro: describe QUÉ se muestra y a qué elemento (`data-tour`) apunta; el
 * proveedor decide cuándo avanzar.
 */
export type TourStepId =
  | 'welcome'
  | 'balance-chip'
  | 'balance-chip-tap'
  | 'buy'
  | 'logo'
  | 'dish'
  | 'sides'
  | 'add'
  | 'cart'
  | 'picker'
  | 'balance-box'
  | 'confirm'
  | 'final';

/** `info`: se mira (no se toca); `tap`: hay que tocar el elemento real; `try`: se puede probar o seguir. */
export type TourMode = 'info' | 'tap' | 'try';

export type TourGuide =
  | 'ofrece'
  | 'panero'
  | 'de'
  | 'malabarista'
  | 'duda'
  | 'chef'
  | 'bandeja'
  | 'esperando'
  | 'iz';

export type TourRoute = '/orders/today' | '/credits';

interface BaseStep {
  id: TourStepId;
  title: string;
  text: string;
  /** Pantalla en la que vive el paso: al ir adelante/atrás el tour navega ahí si hace falta. */
  route: TourRoute;
}

export interface TourCardStep extends BaseStep {
  kind: 'card';
}

export interface TourSpotStep extends BaseStep {
  kind: 'spot';
  /** Valor del atributo `data-tour` del elemento resaltado. */
  target: string;
  mode: TourMode;
  radius: number;
  guide: TourGuide;
  /** Cómo traer el elemento a la vista al llegar al paso. */
  scroll?: ScrollLogicalPosition;
}

export type TourStep = TourCardStep | TourSpotStep;

const spot = (step: Omit<TourSpotStep, 'kind'>): TourSpotStep => ({ kind: 'spot', ...step });

export function buildTourSteps({ isDesktop }: { isDesktop: boolean }): TourStep[] {
  return [
    {
      kind: 'card',
      id: 'welcome',
      route: '/orders/today',
      title: '¡Te regalamos un almuerzo!',
      text: 'Para que pruebes Arias, tu primer almuerzo va por nuestra cuenta.',
    },
    spot({
      id: 'balance-chip',
      route: '/orders/today',
      target: 'balance-chip',
      mode: 'info',
      radius: 999,
      guide: 'ofrece',
      title: 'Este es tu saldo de almuerzos',
      text: 'Te regalamos 1 para que pruebes. Lo usás cuando confirmás tu primer pedido.',
    }),
    spot({
      id: 'balance-chip-tap',
      route: '/orders/today',
      target: 'balance-chip',
      mode: 'tap',
      radius: 999,
      guide: 'ofrece',
      title: 'Tocá tu saldo',
      text: 'Ahí ves cuántos almuerzos tenés y desde ahí comprás más.',
    }),
    spot({
      id: 'buy',
      route: '/credits',
      target: 'buy',
      mode: 'info',
      radius: 8,
      guide: 'panero',
      title: 'Acá comprás más almuerzos',
      text: 'Sueltos o en paquete: cuantos más llevás, menos pagás cada uno.',
    }),
    spot({
      id: 'logo',
      route: '/credits',
      target: 'logo',
      mode: 'tap',
      radius: 10,
      guide: 'de',
      title: 'Volvé al menú',
      text: 'Tocá ARIAS cuando quieras volver a pedir.',
    }),
    spot({
      id: 'dish',
      route: '/orders/today',
      target: 'dish',
      mode: 'tap',
      radius: 10,
      guide: 'malabarista',
      title: 'Elegí un plato',
      text: 'Tocá un plato para ver el detalle y armar tu pedido.',
    }),
    spot({
      id: 'sides',
      route: '/orders/today',
      target: 'sides',
      mode: 'tap',
      radius: 10,
      guide: 'duda',
      scroll: 'center',
      title: '¿Con qué lo acompañás?',
      text: 'Algunos platos vienen con guarnición o salsa. Tocá la que quieras.',
    }),
    spot({
      id: 'add',
      route: '/orders/today',
      target: 'add',
      mode: 'tap',
      radius: 8,
      guide: 'chef',
      title: 'Sumalo a tu pedido',
      text: 'Podés agregar más de un plato antes de confirmar.',
    }),
    // En escritorio el pedido es un panel siempre visible: no hay "Ver pedido".
    ...(isDesktop
      ? []
      : [
          spot({
            id: 'cart',
            route: '/orders/today',
            target: 'cart',
            mode: 'tap',
            radius: 8,
            guide: 'bandeja',
            title: 'Tu pedido te espera acá abajo',
            text: 'Tocá «Ver pedido» para revisarlo.',
          }),
        ]),
    spot({
      id: 'picker',
      route: '/orders/today',
      target: 'picker',
      mode: 'try',
      radius: 10,
      guide: 'esperando',
      scroll: 'nearest',
      title: 'Elegí cuándo lo retirás',
      text: 'Lo antes posible o a la hora que quieras: te lo tenemos listo.',
    }),
    spot({
      id: 'balance-box',
      route: '/orders/today',
      target: 'balance-box',
      mode: 'info',
      radius: 8,
      guide: 'panero',
      scroll: 'nearest',
      title: 'Tu saldo, antes de confirmar',
      text: 'Ves cuántos almuerzos tenés, cuántos usa este pedido y cuántos te quedan.',
    }),
    spot({
      id: 'confirm',
      route: '/orders/today',
      target: 'confirm',
      // Informativo a propósito: el tour nunca confirma un pedido, lo hace el cliente.
      mode: 'info',
      radius: 8,
      guide: 'iz',
      title: 'Confirmá cuando estés listo',
      text: 'Este botón manda tu pedido a la cocina. Lo tocás vos cuando termine el tour.',
    }),
    {
      kind: 'card',
      id: 'final',
      route: '/orders/today',
      title: '¡Listo! Ya podés pedir tu primer plato',
      text: 'Tu pedido quedó armado con tu almuerzo de regalo. Revisá el horario y confirmalo cuando quieras.',
    },
  ];
}

export function stepCounter(
  steps: TourStep[],
  id: TourStepId,
): { position: number; total: number } | null {
  const spots = steps.filter((s) => s.kind === 'spot');
  const index = spots.findIndex((s) => s.id === id);
  return index === -1 ? null : { position: index + 1, total: spots.length };
}

export function nextStepId(steps: TourStep[], id: TourStepId): TourStepId | null {
  const index = steps.findIndex((s) => s.id === id);
  return index === -1 || index === steps.length - 1 ? null : steps[index + 1].id;
}

export function previousStepId(steps: TourStep[], id: TourStepId): TourStepId | null {
  const index = steps.findIndex((s) => s.id === id);
  return index <= 0 ? null : steps[index - 1].id;
}
