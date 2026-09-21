# Diseño: Pivote a Créditos B2C (aditivo) — mitad frontend

Este documento cubre exclusivamente el frontend del cambio `b2c-credits-pivot`. El dominio y la API
que este cambio consume están diseñados en
`C:\Arias\backend\openspec\changes\b2c-credits-pivot\design.md`. La sección "Contrato con el backend"
de este documento resume, del lado del consumidor, los endpoints y payloads relevantes — ver el
diseño del backend como fuente de verdad si hay alguna discrepancia. Ver `proposal.md` de este mismo
directorio para el contexto del split en dos repositorios y el orden de implementación (backend
primero).

## Enfoque técnico

`features/credits/` nuevo (`services/creditsApi.ts`, `components/{WalletBalance,PackCard,PurchaseHistory}`,
`hooks/useWallet.ts`), siguiendo la estructura `features/{dominio}/{components,hooks,services,store}`
ya usada por el resto del código base. Rutas nuevas: `/register`, `/verify-email`,
`/complete-profile`, `/credits`, `/credits/packs`, `/credits/checkout/{exito,pendiente,error}`,
`/corporate`.

Ningún componente ni servicio de este cambio implementa lógica de negocio: validación de saldo,
vencimiento, otorgamiento del almuerzo de bienvenida, mapeo de estados de pago, etc. son
responsabilidad exclusiva del backend. El frontend solo presenta lo que la API devuelve y dispara las
acciones que la API expone.

## Decisiones de arquitectura

### Decisión F1: página de retorno del checkout nunca acredita

**Elección**: la página de retorno del checkout hace **polling** de
`GET /api/v1/credits/purchases/{id}` y muestra "procesando" hasta que el backend confirme
`APPROVED`. No interpreta `back_urls`/parámetros de query de Mercado Pago como confirmación de pago.

**Razón**: la acreditación ocurre únicamente en el webhook del backend (ver diseño backend, Decisión
3 e Idempotencia). Si la UI afirmara éxito a partir de la sola redirección del navegador, un usuario
podría ver "acreditado" y el crédito nunca llegar (pago rechazado tras la redirección, webhook
demorado, etc.). Esto es un requisito de UI de la capacidad `credits-ui` (ver `specs/credits-ui/spec.md`
de este mismo repositorio), contraparte de la capacidad de dominio `credit-pack-purchase` del backend.

### Decisión F2: billetera con saldo AVAILABLE y COMMITTED separados

**Elección**: `WalletBalance` muestra ambos valores como dos cifras distintas, nunca sumadas en un
único "saldo total", para que el usuario entienda cuántos almuerzos puede comprometer en un pedido
nuevo frente a cuántos ya están reservados en pedidos pendientes de retiro.

**Razón**: refleja al usuario el mismo modelo de dos buckets que expone `GET /api/v1/credits/wallet`
(ver diseño backend, Decisión 3). Sumarlos ocultaría información que el usuario necesita antes de
pedir de nuevo.

### Decisión F3: `self-registration` se divide en dominio (backend) y flujo de UI (frontend)

**Elección**: esta mitad implementa únicamente las pantallas — formulario de registro, botón
"Iniciar sesión con Google", pantalla de completar perfil, pantalla de felicitación, y los mensajes de
verificación de correo pendiente. La validación de campos duplicados, la unicidad de teléfono, la
verificación del ID token de Google y el otorgamiento del almuerzo de bienvenida son responsabilidad
del backend; el frontend solo muestra los errores que la API devuelve.

**Razón**: evita que la misma regla de negocio (p. ej. "teléfono ya registrado") quede definida dos
veces en dos repositorios que pueden divergir. Ver `specs/self-registration/spec.md` de este
repositorio para los requisitos de UI exactos, y la copia del backend para los de dominio.

### Decisión F4: landing dividida, contenido corporativo trasladado tal cual

`LandingPage.tsx` pasa a ser el recorrido B2C; el contenido corporativo se mueve tal cual a
`pages/CorporatePage.tsx`, reutilizando sin cambios `QuoteForm`, `LandingNav` y `useScrollReveal`. No
hay reescritura de esos tres componentes: es un traslado de árbol, no un rediseño.

### Decisión F5: Vitest + Testing Library

`vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom`, configuración dentro de
`vite.config.ts` (bloque `test`) para no duplicar los alias `@/`, y script `"test": "vitest run"`.
Esta es la primera herramienta de testing del proyecto frontend; se introduce como su propia unidad
de trabajo antes de construir cualquier feature nueva sobre ella, para no acumular código sin tests
propios desde el día uno.

## Contrato con el backend

Endpoints consumidos por este cambio (definidos y expuestos por
`C:\Arias\backend\openspec\changes\b2c-credits-pivot\design.md`, sección "Interfaces y contratos"):

| Endpoint | Usado por | Payload relevante |
|---|---|---|
| `POST /api/v1/auth/register` | `features/auth` — formulario de registro | nombre, correo, teléfono, apodo |
| `POST /api/v1/auth/verify-email` | `features/auth` — paso de verificación | token del enlace/código |
| `POST /api/v1/auth/resend-verification` | `features/auth` — reenvío de verificación | correo |
| `POST /api/v1/auth/google` | `features/auth` — botón de Google | ID token de `@react-oauth/google` |
| `POST /api/v1/auth/complete-profile` | `features/auth` — pantalla de completar perfil | teléfono, apodo |
| `GET /api/v1/auth/me` | guards de ruta / `authStore` | expone `emailVerified`, `profileComplete` |
| `GET /api/v1/credits/wallet` | `features/credits` — `useWallet`, `WalletBalance` | `available`, `committed`, `expiresAt` |
| `GET /api/v1/credits/movements` | `features/credits` — `PurchaseHistory` | historial de movimientos |
| `GET /api/v1/credits/packs` | `features/credits` — `PackCard` | catálogo de paquetes habilitados |
| `POST /api/v1/credits/purchases` | `features/credits` — inicio de checkout | `packId` o `orderId`; responde `initPoint` para redirigir |
| `GET /api/v1/credits/purchases/{id}` | `features/credits` — página de retorno del checkout (polling) | `status` (`PENDING`/`APPROVED`/`REJECTED`/...) |
| `GET /api/v1/orders/pickup-slots?fecha=` | `features/orders` — selector de horario de retiro | slots válidos para la fecha |
| `POST /api/v1/orders` | `features/orders` — confirmar carrito | `PlaceOrderV2Request` (ítems, `pickupAt`) |
| `DELETE /api/v1/orders/{id}` | `features/orders` — cancelar pedido | — |
| `GET /api/v1/admin/orders/by-pickup?fecha=` | `pages/admin` — vista agrupada por horario | pedidos agrupados |
| `GET /api/v1/admin/orders/export/by-pickup?fecha=` | `pages/admin` — exportación | archivo exportado |
| CRUD `/api/v1/admin/credit-packs` | `pages/admin` — administración de paquetes | `CreditPackDto` |
| Edición de `restaurant_config` (7 campos nuevos) | `pages/admin` — configuración | ver diseño backend, tabla V20 |

Todos los payloads se consumen serializados en JSON camelCase con fechas ISO-8601 (convención Jackson
ya usada en el resto de la API). Ningún endpoint de este listado se implementa en este repositorio;
si alguno todavía no existe al iniciar una unidad de trabajo de frontend, esa unidad está bloqueada
hasta que el backend la exponga.

## Cambios de archivos (frontend)

| Archivo | Acción | Descripción |
|---|---|---|
| `frontend/src/features/credits/**` | Crear | Billetera, paquetes, retorno de checkout, historial |
| `frontend/src/features/auth/**` | Modificar | Registro, verificación, botón de Google, completar perfil; `EmailStep`/`FirstLoginStep` sin cambios |
| `frontend/src/features/orders/**` | Modificar | Carrito multi-ítem, selector de horario de retiro, costo en "almuerzos" |
| `frontend/src/pages/CorporatePage.tsx` | Crear | Contenido corporativo trasladado tal cual |
| `frontend/src/pages/LandingPage.tsx`, `routes.tsx` | Modificar | Landing B2C en la raíz, `/corporate`, rutas nuevas; rutas de admin/company-admin intactas |
| `frontend/src/pages/admin/` | Modificar | Agrupación por horario de retiro, CRUD de `credit-pack`, edición de configuración nueva |
| `frontend/vite.config.ts`, `package.json`, `src/test/setup.ts` | Modificar/Crear | Vitest + Testing Library + `npm test` |

## Estrategia de testing (frontend)

| Capa | Qué se prueba | Cómo |
|---|---|---|
| Unit | Formateo "N almuerzo(s)"; total del carrito; filtro de slots de retiro; guard de perfil incompleto | Vitest + Testing Library |
| Componente | Billetera muestra AVAILABLE y COMMITTED por separado; la página de retorno del checkout muestra "procesando" y **no** afirma acreditación mientras el estado es `PENDING`; formulario de registro señala campos faltantes; render del botón de Google; landing raíz no muestra contenido corporativo y `/corporate` lo conserva | Vitest + Testing Library + `jsdom` |
| Manual | Regresión completa del flujo de empresas end-to-end (lista blanca, pantallas de admin de empresas, pedido de empleado) tras el cambio | Checklist en la fase de tareas |

`npm test` (`vitest run`), `npm run lint` y `tsc -b` deben pasar.

## Matriz de amenazas

N/A — el cambio no toca enrutamiento de procesos, comandos de shell, subprocesos, automatización de
VCS/PR, clasificación de archivos ejecutables ni integración de procesos. La superficie es UI que
consume HTTP saliente hacia la propia API del backend (mismo origen o CORS ya configurado); no se
agregan integraciones externas nuevas del lado del cliente más allá de Google Identity Services para
obtener el ID token, que se envía tal cual al backend para su validación.

## Migración y reversión

No hay migraciones de datos en este repositorio. Revertir = descartar la rama de frontend; no afecta
al backend ni a datos existentes. Las pantallas de administración de empresas quedan intactas por
construcción, ya que ningún archivo de esa área se modifica.

## Puntos abiertos

- Copys exactos de la pantalla de felicitación y de los mensajes de verificación de correo pendiente
  (contenido, no código).
- Diseño visual final de `WalletBalance`, `PackCard` y `PurchaseHistory` (fuera del alcance de SDD; se
  resuelve con el equipo de diseño).
- Confirmar con el backend el shape exacto de `MeResponse` (`emailVerified`, `profileComplete`) antes
  de escribir los guards de ruta de la unidad de autorregistro.
