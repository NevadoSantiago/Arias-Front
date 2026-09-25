import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mismo motivo que el `testTimeout` de `vite.config.ts`: cada archivo levanta
// su propio jsdom y la suite completa satura una máquina con poca memoria.
// El default de Testing Library (1000ms) alcanza sobrado en un archivo
// aislado, pero un `findBy*` que espera una query de React Query puede
// superarlo corriendo junto a los otros ~20 archivos — no por un bug, sino
// por contención de CPU/memoria real, observada de forma reproducible en
// este entorno.
configure({ asyncUtilTimeout: 5000 });

// jsdom doesn't implement matchMedia or IntersectionObserver — polyfilled
// here (not in production code) so any component using them (e.g.
// `useScrollReveal`, reused unmodified by the landing split) can render
// under Vitest without throwing.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// Cast to an untyped record — `Window`/`globalThis` already declare
// `IntersectionObserver` as always present, which would narrow the runtime
// presence check below to `never` and make TS reject the assignment.
const globalWithIO = globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver };

if (!globalWithIO.IntersectionObserver) {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalWithIO.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  cleanup();
});
