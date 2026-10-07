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
}

/** Pasos en los que ya hay un plato en el carrito (agregado por el cliente durante el tour). */
const WITH_CART_ITEM: TourStepId[] = ['cart', 'picker', 'balance-box', 'confirm', 'final'];

const NO_ORDER_COPY = {
  title: '¡Listo! Ya conocés Arias',
  text: 'Hoy no hay platos para pedir, pero cuando haya menú vas a poder armar tu pedido desde acá.',
};

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
 * El tour solo mira y señala: nunca confirma un pedido. En los pasos "tocá acá"
 * deja pasar el toque al elemento real y avanza al detectarlo.
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
  const registerPageControls = useCallback((controls: TourPageControls | null) => {
    controlsRef.current = controls;
  }, []);

  // Solo B2C y solo si el backend dice explícitamente "sin ver" (undefined = backend viejo, no arranca).
  const eligible =
    !!user && user.role === 'EMPLOYEE' && user.companyId == null && user.onboardingTourSeenAt === null;

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
    setSession(null);
    if (!current) return;
    setFinishedFor(current.id);
    setUser({ ...current, onboardingTourSeenAt: new Date().toISOString() });
    // No bloquea nada si falla: el backend lo marcará en un próximo intento.
    markOnboardingTourSeen().catch(() => {});
  }, [setUser]);

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

  const stepId = session?.stepId ?? null;

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
        clearCart: target === 'dish' && WITH_CART_ITEM.includes(stepId),
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

  // Pasos "tocá acá": el toque llega al elemento real (la capa deja el recorte libre)
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

  const value = useMemo(() => ({ active, registerPageControls }), [active, registerPageControls]);

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
