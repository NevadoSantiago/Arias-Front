# Tasks: Pivote a Créditos B2C (aditivo) — mitad frontend

Este archivo cubre exclusivamente las unidades de trabajo de frontend (equivalentes a las unidades
14–18 del cambio combinado original, renumeradas 1–5 preservando su orden y contenido). Depende de
que la mitad backend esté implementada primero:
`C:\Arias\backend\openspec\changes\b2c-credits-pivot\tasks.md`.

## Review Workload Forecast

| Campo | Valor |
|---|---|
| Líneas estimadas | ~1400 (suma de las 5 unidades de trabajo de frontend, ~27% del total original de ~5150) |
| Riesgo de presupuesto de 400 líneas | High |
| PRs encadenados recomendados | No — el desarrollador no abre PRs; la entrega es `single-pr` |
| División sugerida | 5 unidades de trabajo secuenciales, una por commit |
| Estrategia de entrega | single-pr |
| Estrategia de cadena | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

**Nota sobre PRs**: el desarrollador trabaja solo y no abre pull requests. La división en 5 unidades
de trabajo NO es una cadena de PRs — es una secuencia de commits, cada uno dejando `npx vitest run`
en verde a partir de la unidad 1. El PR único de este repositorio (si se abre alguno) requiere
`size:exception` del orquestador antes de `sdd-apply`, dado que ~1400 líneas excede el presupuesto de
400. Ninguna unidad de este archivo debe iniciarse antes de que los endpoints correspondientes del
backend (ver "Contrato con el backend" en `design.md`) existan y estén accesibles.

### Unidades de trabajo sugeridas

| # | Objetivo | Commit | Test focalizado | Harness de runtime | Límite de rollback |
|---|---|---|---|---|---|
| 1 | Vitest + Testing Library (tooling) | 1 | `npx vitest run` (smoke test) | jsdom | Revertir `vite.config.ts`/`package.json`/`src/test/setup.ts` |
| 2 | Frontend: auth (registro/verificación/Google) | 2 | `npx vitest run src/features/auth` | jsdom + MSW o fetch mock | Revertir `features/auth/**` nuevo |
| 3 | Frontend: credits (billetera/paquetes/checkout) | 3 | `npx vitest run src/features/credits` | jsdom | Eliminar `features/credits/**` |
| 4 | Frontend: orders (carrito/retiro) | 4 | `npx vitest run src/features/orders` | jsdom | Revertir cambios en `features/orders/**` |
| 5 | Frontend: landing split + admin | 5 | `npx vitest run` + `npm run lint` + `tsc -b` | jsdom | Revertir `routes.tsx`, `LandingPage.tsx`, `CorporatePage.tsx` |

## Unidad 1 — Vitest + Testing Library (frontend, PRIMERA unidad de frontend)

- [x] 1.1 `frontend/package.json`: agregar devDependencies `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; script `"test": "vitest run"`.
- [x] 1.2 `frontend/vite.config.ts`: bloque `test` (environment `jsdom`, `setupFiles`) reutilizando los alias `@/` existentes.
- [x] 1.3 Crear `frontend/src/test/setup.ts` (import de `@testing-library/jest-dom`).
- [x] 1.4 Test de humo mínimo sobre un componente ya existente (por ejemplo `DishCard`) para validar que el runner funciona antes de construir features nuevas sobre él.

Verificación: `npx vitest run` (desde `frontend/`), luego `npm run lint` y `tsc -b`.

## Unidad 2 — Frontend: auth (registro / verificación / Google / complete-profile)

- [ ] 2.1 Crear pantallas de registro/verificación en `frontend/src/features/auth/components/` (`RegisterForm`, `VerifyEmailStep`, `CompleteProfileForm`) + botón Google (`@react-oauth/google`).
- [ ] 2.2 Extender `frontend/src/features/auth/services/authApi.ts` con `register`, `verifyEmail`, `resendVerification`, `googleLogin`, `completeProfile` (consumen los endpoints de `POST /api/v1/auth/*` del backend, ver "Contrato con el backend" en `design.md`).
- [ ] 2.3 Rutas nuevas `/register`, `/verify-email`, `/complete-profile` en `frontend/src/routes.tsx`. `EmailStep`/`FirstLoginStep` existentes no se tocan.
- [ ] 2.4 Test Vitest: formato de errores de validación, guard de perfil incompleto, render del botón Google — cubre los requisitos de flujo de UI de la copia frontend de la spec `self-registration` (los de dominio/API/verificación/otorgamiento del almuerzo de bienvenida están cubiertos y probados en la mitad backend).

Verificación: `npx vitest run src/features/auth`, `npm run lint`, `tsc -b`.

## Unidad 3 — Frontend: credits (billetera / paquetes / checkout)

- [ ] 3.1 Crear `frontend/src/features/credits/{services/creditsApi.ts,hooks/useWallet.ts,components/{WalletBalance,PackCard,PurchaseHistory}.tsx}`.
- [ ] 3.2 Rutas `/credits`, `/credits/packs`, `/credits/checkout/{exito,pendiente,error}` en `routes.tsx`; la página de retorno hace polling de `GET /api/v1/credits/purchases/{id}` y muestra "procesando" — **nunca** acredita desde el frontend.
- [ ] 3.3 Test Vitest: `WalletBalance` muestra AVAILABLE y COMMITTED por separado; la página de retorno no afirma acreditación mientras el estado es `PENDING` — cubre spec `credits-ui` (la contraparte de UI de `credit-pack-purchase`/`credit-ledger`, capacidades de dominio del backend).

Verificación: `npx vitest run src/features/credits`, `npm run lint`, `tsc -b`.

## Unidad 4 — Frontend: orders (carrito multi-ítem / retiro)

- [ ] 4.1 Modificar `frontend/src/features/orders/**`: carrito multi-ítem, selector de horario de retiro (consume `GET /api/v1/orders/pickup-slots`), costo visible en "almuerzos" (nunca "créditos").
- [ ] 4.2 Modificar `frontend/src/features/orders/services/ordersApi.ts` para `PlaceOrderV2Request`.
- [ ] 4.3 Test Vitest: total del carrito, filtro de slots de retiro, formateo "N almuerzo(s)" — implementa la contraparte de UI de las specs backend `order-placement` y `pickup-scheduling`; ninguna de las dos vive en este repositorio.

Verificación: `npx vitest run src/features/orders`, `npm run lint`, `tsc -b`.

## Unidad 5 — Frontend: landing split + admin (cierre)

- [ ] 5.1 Crear `frontend/src/pages/CorporatePage.tsx` con el contenido corporativo trasladado tal cual (reutiliza `QuoteForm`, `LandingNav`, `useScrollReveal` sin cambios).
- [ ] 5.2 Modificar `frontend/src/pages/LandingPage.tsx` para el recorrido B2C (historia → registro); `routes.tsx` agrega `/corporate`, rutas de admin/company-admin intactas.
- [ ] 5.3 Frontend admin: vista de agrupación por horario de retiro en `pages/admin/` (consume los endpoints de la unidad 13 de la mitad backend), CRUD de `credit-pack` (`SUPER_ADMIN`), edición de los 7 campos de `restaurant_config`.
- [ ] 5.4 Test Vitest: la raíz muestra contenido B2C y no muestra contenido corporativo; `/corporate` conserva el formulario de cotización — cubre spec `public-landing` completa.
- [ ] 5.5 Regresión manual completa: flujo de empresas de punta a punta (lista blanca, pantallas de admin de empresas, pedido de empleado) — cubre los "Criterios de éxito" de `proposal.md` (backend y frontend).

Verificación: `npx vitest run`, `npm run lint`, `tsc -b` (suite frontend completa) — cierre de la mitad frontend del cambio. La regresión backend (`./mvnw test`) ya se validó al cerrar la unidad 13 del repositorio backend.
