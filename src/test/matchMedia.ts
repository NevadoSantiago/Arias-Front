/** Helper de tests: `window.matchMedia` controlable (jsdom no tiene layout). */
type Listener = () => void;

/** Reemplaza `window.matchMedia` por uno controlable; devuelve `set` para cambiar el resultado. */
export function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((l) => l());
    },
    restore() {
      window.matchMedia = original;
    },
  };
}
