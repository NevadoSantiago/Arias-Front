import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { TourFinalCard, TourWelcomeCard } from './TourCards';
import { TourContext, type TourPageControls } from './TourContext';
import { TourSpotlight } from './TourSpotlight';
import { markOnboardingTourSeen } from './services/tourApi';
import {
  buildTourSteps,
  nextStepId,
  previousStepId,
  stepCounter,
  type TourStepId,
} from './tourSteps';
import { findTourTarget } from './useTargetRect';

interface Session {
  userId: number;
  stepId: TourStepId;
  /** No había platos para pedir: el tour termina antes, con un cierre distinto. */
  noOrder: boolean;
  /** Repetición a pedido: no vuelve a marcar el tour como visto ni limpia el carrito del cliente. */
  replay?: boolean;
}

/** Pasos en los que ya hay un plato en el carrito (agregado por el cliente durante el tour). */
const WITH_CART_ITEM: TourStepId[] = ['cart', 'picker', 'balance-box', 'confirm', 'final'];

const NO_ORDER_COPY = {
  title: '¡Listo! Ya conocés Arias',
  text: 'Hoy no hay platos para pedir, pero cuando haya menú vas a poder armar tu pedido desde acá.',
};

/** "Hoy no se puede pedir, así que te llevamos al jueves 15 de octubre." Fecha parseada como LOCAL, nunca como UTC. */
function movedNote(date: string): string {
  // Según la versión de ICU, es-AR pone o no una coma tras el día de la semana: se la saca.
  const day = new Date(`${date}T12:00:00`)
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '');
  return `Hoy no se puede pedir, así que te llevamos al ${day}.`;
}

interface Props {
  children: ReactNode;
  /** Cuánto espera un paso a que aparezca su elemento antes de saltearlo. */
  targetTimeoutMs?: number;
}

/**
 * Tour de primer ingreso del cliente B2C (sin empresa). Vive por encima de las
 * rutas para sobrevivir a la navegación entre el pedido y la billetera y a las
 * hojas que se abren: arranca solo la primera vez que el cliente llega a
 * `/orders/today` con el tour sin ver, y al terminar o saltarlo lo guarda en
 * el backend (sin bloquear la pantalla si falla: se reintenta la próxima sesión).
 *
 * El tour solo mira y señala: nunca confirma un pedido. En los pasos "tocá" una
 * flecha señala el elemento, la capa oscura no avanza, y el toque llega al
 * elemento real y avanza al detectarlo. En los de mirar y probar, tocar la capa
 * oscura equivale a "Siguiente".
 */
export function TourProvider({ children, targetTimeoutMs = 5000 }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const steps = useMemo(() => buildTourSteps({ isDesktop }), [isDesktop]);

  const [session, setSession] = useState<Session | null>(null);
  const [finishedFor, setFinishedFor] = useState<number | null>(null);
  const controlsRef = useRef<TourPageControls | null>(null);
  // Sube cada vez que la pantalla registra sus controles: el paso del plato puede empezar antes de que
  // la pantalla termine de montarse (al volver de /credits) y necesita reintentar cuando aparezcan.
  const [controlsVersion, setControlsVersion] = useState(0);
  const registerPageControls = useCallback((controls: TourPageControls | null) => {
    controlsRef.current = controls;
    if (controls) setControlsVersion((v) => v + 1);
  }, []);
  // Paso del plato: ya se consultó si el día elegido se puede pedir, y a qué día se pasó (si se pasó).
  const [dishChecked, setDishChecked] = useState(false);
  const [movedToDate, setMovedToDate] = useState<string | null>(null);

  // Solo B2C y solo si el backend dice explícitamente "sin ver" (undefined = backend viejo, no arranca).
  const eligible =
    !!user && user.role === 'EMPLOYEE' && user.companyId == null && user.onboardingTourSeenAt === null;

  // Repetir el tour solo lo ofrece a clientes B2C; no depende de si ya lo vieron.
  const canReplay = !!user && user.role === 'EMPLOYEE' && user.companyId == null;

  // Estado derivado durante el render (patrón de React), sin efectos.
  if (session && (!user || session.userId !== user.id)) {
    setSession(null);
  } else if (!session && eligible && finishedFor !== user.id && pathname === '/orders/today') {
    setSession({ userId: user.id, stepId: 'welcome', noOrder: false });
  }

  const step = session ? (steps.find((s) => s.id === session.stepId) ?? null) : null;
  const active = !!session && !!step;

  const finish = useCallback(() => {
    const current = useAuthStore.getState().user;
    const wasReplay = session?.replay === true;
    setSession(null);
    if (!current) return;
    setFinishedFor(current.id);
    // Una repetición no toca lo ya guardado: el tour ya se vio.
    if (wasReplay) return;
    setUser({ ...current, onboardingTourSeenAt: new Date().toISOString() });
    // No bloquea nada si falla: el backend lo marcará en un próximo intento.
    markOnboardingTourSeen().catch(() => {});
  }, [session, setUser]);

  /** Va a un paso y, si vive en otra pantalla, navega hasta ahí. */
  const goTo = useCallback(
    (id: TourStepId, patch: Partial<Session> = {}) => {
      const target = steps.find((s) => s.id === id);
      if (!target) return;
      setSession((prev) => (prev ? { ...prev, ...patch, stepId: id } : prev));
      if (target.route !== pathname) navigate(target.route);
    },
    [steps, pathname, navigate],
  );

  const replay = useCallback(() => {
    const current = useAuthStore.getState().user;
    if (!current) return;
    setSession({ userId: current.id, stepId: 'balance-chip', noOrder: false, replay: true });
    if (pathname !== '/orders/today') navigate('/orders/today');
  }, [pathname, navigate]);

  const stepId = session?.stepId ?? null;

  // Cada vez que cambia el paso se olvida lo del paso del plato (estado derivado durante el render).
  const [trackedStepId, setTrackedStepId] = useState<TourStepId | null>(null);
  if (trackedStepId !== stepId) {
    setTrackedStepId(stepId);
    if (dishChecked) setDishChecked(false);
    if (movedToDate !== null) setMovedToDate(null);
  }

  const next = useCallback(() => {
    if (!stepId) return;
    const id = nextStepId(steps, stepId);
    if (id) goTo(id);
    else finish();
  }, [steps, stepId, goTo, finish]);

  const prev = useCallback(() => {
    if (!stepId || !session) return;
    let target = session.noOrder && stepId === 'final' ? 'logo' : previousStepId(steps, stepId);
    if (!target) return;
    // Si la hoja del plato ya no está abierta no se puede volver a ella: se vuelve al plato.
    const sheetOpen = !!findTourTarget('add');
    if ((target === 'add' && !sheetOpen) || (target === 'sides' && !findTourTarget('sides'))) {
      target = 'dish';
    }
    if (target === 'dish' || target === 'cart') {
      controlsRef.current?.resetOrderUi({
        clearCart: !session.replay && target === 'dish' && WITH_CART_ITEM.includes(stepId),
      });
    }
    goTo(target as TourStepId, { noOrder: false });
  }, [steps, stepId, session, goTo]);

  const browseMenu = useCallback(() => {
    controlsRef.current?.resetOrderUi({ clearCart: false });
    finish();
  }, [finish]);

  const handleTargetMissing = useCallback(() => {
    if (!stepId) return;
    if (stepId === 'dish') {
      // Sin platos para pedir: cierre adaptado, sin "Ir a confirmar".
      setSession((prevSession) => (prevSession ? { ...prevSession, stepId: 'final', noOrder: true } : prevSession));
      return;
    }
    next();
  }, [stepId, next]);

  // Al empezar el paso del plato (la primera vez y al volver con "Anterior") la pantalla pasa a un día
  // que se pueda pedir. Mientras tanto el recorte espera (`holdTarget`) y, si ningún día sirve, el tour
  // cierra sin esperar el tiempo de espera del elemento. Al salir del paso se limpia para la próxima vez.
  useEffect(() => {
    if (stepId !== 'dish' || dishChecked) return;
    const controls = controlsRef.current;
    if (!controls) {
      // La pantalla todavía no registró sus controles (`controlsVersion` re-ejecuta este efecto cuando lo
      // haga). Si nunca aparecen, se sigue como antes: el elemento que falta cierra el tour solo.
      const giveUp = setTimeout(() => setDishChecked(true), targetTimeoutMs);
      return () => clearTimeout(giveUp);
    }
    // Si el paso cambia mientras se consulta, la respuesta tardía se ignora.
    let cancelled = false;
    controls.ensureOrderableDay().then(
      ({ moved, orderable }) => {
        if (cancelled) return;
        if (!orderable) {
          setSession((prevSession) => (prevSession ? { ...prevSession, stepId: 'final', noOrder: true } : prevSession));
          return;
        }
        setMovedToDate(moved);
        setDishChecked(true);
      },
      () => {
        // Si la consulta falla se sigue como antes: el paso espera al plato con su tiempo de espera.
        if (!cancelled) setDishChecked(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stepId, dishChecked, controlsVersion, targetTimeoutMs]);

  // Pasos "tocá": el toque llega al elemento real (la capa deja el recorte libre)
  // y el tour avanza al detectarlo.
  const tapStep = step?.kind === 'spot' && step.mode === 'tap' ? step : null;
  useEffect(() => {
    if (!tapStep) return;
    const onClick = (event: MouseEvent) => {
      const el = findTourTarget(tapStep.target);
      const hit = event.target;
      if (!el || !(hit instanceof Node) || !el.contains(hit)) return;

      if (tapStep.id === 'sides' && !(hit instanceof Element && hit.closest('[role="radio"]'))) return;

      let nextId = nextStepId(steps, tapStep.id);
      if (tapStep.id === 'dish' && el.getAttribute('data-tour-has-side') === 'false') {
        nextId = 'add';
      }
      if (tapStep.id === 'add') {
        const sides = findTourTarget('sides');
        // Sin acompañamiento elegido el plato no se agrega: se vuelve a pedirlo.
        if (sides && !sides.querySelector('[aria-checked="true"]')) nextId = 'sides';
      }
      if (nextId) setSession((prevSession) => (prevSession ? { ...prevSession, stepId: nextId } : prevSession));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [tapStep, steps]);

  // Escape saltea el tour: con una hoja abierta el foco no puede llegar a "Saltar tour".
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      finish();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [active, finish]);

  const value = useMemo(
    () => ({ active, registerPageControls, canReplay, replay }),
    [active, registerPageControls, canReplay, replay],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {session &&
        step &&
        createPortal(
          step.kind === 'spot' ? (
            <TourSpotlight
              key={step.id}
              step={step}
              counter={stepCounter(steps, step.id)}
              canGoBack={step.id !== 'balance-chip'}
              targetTimeoutMs={targetTimeoutMs}
              holdTarget={step.id === 'dish' && !dishChecked}
              note={step.id === 'dish' && movedToDate ? movedNote(movedToDate) : undefined}
              onNext={next}
              onPrev={prev}
              onSkip={finish}
              onTargetMissing={handleTargetMissing}
            />
          ) : step.id === 'welcome' ? (
            <TourWelcomeCard
              title={step.title}
              text={step.text}
              onStart={() => goTo('balance-chip')}
              onSkip={finish}
            />
          ) : (
            <TourFinalCard
              title={session.noOrder ? NO_ORDER_COPY.title : step.title}
              text={session.noOrder ? NO_ORDER_COPY.text : step.text}
              canOrder={!session.noOrder}
              onConfirmOrder={finish}
              onBrowseMenu={browseMenu}
              onPrev={prev}
            />
          ),
          document.body,
        )}
    </TourContext.Provider>
  );
}
