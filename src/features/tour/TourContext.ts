import { createContext, useContext, useEffect, useRef } from 'react';

/** Lo que la pantalla de pedido le deja hacer al tour sobre su estado (hojas y carrito). */
export interface TourPageControls {
  /** Cierra la hoja del plato y la de revisión; con `clearCart` también vacía el carrito. */
  resetOrderUi: (options: { clearCart: boolean }) => void;
}

interface TourContextValue {
  /** true mientras el tour está en pantalla. */
  active: boolean;
  registerPageControls: (controls: TourPageControls | null) => void;
}

/** Sin proveedor (tests, pantallas fuera del tour) el tour está apagado. */
export const TourContext = createContext<TourContextValue>({
  active: false,
  registerPageControls: () => {},
});

export function useTourActive(): boolean {
  return useContext(TourContext).active;
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
    registerPageControls({ resetOrderUi: (options) => latest.current.resetOrderUi(options) });
    return () => registerPageControls(null);
  }, [registerPageControls]);
}
