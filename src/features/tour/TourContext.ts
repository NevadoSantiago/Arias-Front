import { createContext, useContext, useEffect, useRef } from 'react';

/** Lo que la pantalla de pedido le deja hacer al tour sobre su estado (hojas y carrito). */
export interface TourPageControls {
  /** Cierra la hoja del plato y la de revisión; con `clearCart` saca del carrito el plato que agregó el tour (o vacía el día si no sabe cuál fue). */
  resetOrderUi: (options: { clearCart: boolean }) => void;
  /**
   * Si el día elegido no se puede pedir (cerrado, sin horarios, sin platos pedibles o con pedido
   * ya hecho), pasa al primer día de las fichas que sí. `moved` es el día al que pasó (`null` si
   * el actual ya servía); `orderable: false` si ningún día sirve.
   */
  ensureOrderableDay: () => Promise<{ moved: string | null; orderable: boolean }>;
}

interface TourContextValue {
  /** true mientras el tour está en pantalla. */
  active: boolean;
  registerPageControls: (controls: TourPageControls | null) => void;
  /** true si el cliente puede repetir el tour a pedido (B2C), aunque ya lo haya visto. */
  canReplay: boolean;
  /** Repite el tour desde el saldo (sin la tarjeta del regalo) y sin volver a marcarlo como visto. */
  replay: () => void;
}

/** Sin proveedor (tests, pantallas fuera del tour) el tour está apagado. */
export const TourContext = createContext<TourContextValue>({
  active: false,
  registerPageControls: () => {},
  canReplay: false,
  replay: () => {},
});

export function useTourActive(): boolean {
  return useContext(TourContext).active;
}

/** Para el menú de ayuda: si se puede repetir el tour y cómo arrancarlo. */
export function useTourReplay(): { canReplay: boolean; replay: () => void } {
  const { canReplay, replay } = useContext(TourContext);
  return { canReplay, replay };
}

/**
 * Props para el `SheetContent` de Radix: con el tour activo, un toque en la
 * capa del tour (que está "afuera" de la hoja) o Escape no deben cerrarla.
 */
export function useTourSheetGuard(): {
  onInteractOutside: (event: Event) => void;
  onEscapeKeyDown: (event: KeyboardEvent) => void;
} {
  const active = useTourActive();
  const guard = (event: Event) => {
    if (active) event.preventDefault();
  };
  return { onInteractOutside: guard, onEscapeKeyDown: guard };
}

/** La pantalla de pedido registra sus controles mientras está montada. */
export function useTourPageControls(controls: TourPageControls): void {
  const { registerPageControls } = useContext(TourContext);
  const latest = useRef(controls);
  useEffect(() => {
    latest.current = controls;
  });
  useEffect(() => {
    registerPageControls({
      resetOrderUi: (options) => latest.current.resetOrderUi(options),
      ensureOrderableDay: () => latest.current.ensureOrderableDay(),
    });
    return () => registerPageControls(null);
  }, [registerPageControls]);
}
