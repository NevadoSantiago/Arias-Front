# Propuesta: Pivote a Créditos B2C (aditivo) — mitad frontend

## Cambio coordinado en dos repositorios

Este cambio es **una mitad de un cambio SDD coordinado en dos repositorios independientes**. El
mismo cambio `b2c-credits-pivot` fue planificado originalmente en un único directorio (`C:\Arias\openspec`)
que no comparte directorio común de Git con el runtime, y quedó bloqueado (`cross_common_dir_runtime_target`).
Se dividió en dos changes autocontenidos, uno por repositorio:

- **Backend** (mitad hermana, debe implementarse primero): `C:\Arias\backend\openspec\changes\b2c-credits-pivot\`
- **Frontend** (este documento): `C:\Arias\frontend\openspec\changes\b2c-credits-pivot\`

**El backend debe implementarse y desplegarse primero.** Este cambio consume la API que expone el
backend (autorregistro, libro mayor de créditos, pedidos, checkout de Mercado Pago, horarios de
retiro, administración); no hay contrato estable contra el cual construir la UI hasta que esos
endpoints existan. La sección "Contrato con el backend" del `design.md` de este repositorio enumera
los endpoints y payloads que este cambio consume. La copia original combinada en
`C:\Arias\openspec\changes\b2c-credits-pivot\` permanece intacta como referencia de las dos mitades
juntas.

## Intención

Actualmente Arias es exclusivamente B2B: las empresas dan de alta a sus empleados en una lista blanca,
negocian precios por categoría y son facturadas; el cliente nunca ve un precio. El producto incorpora
un canal B2C — las personas se autorregistran a partir de un código QR, compran "almuerzos" con
Mercado Pago y los gastan en platos que retiran en el restaurante.

**Este cambio es ADITIVO, no un reemplazo.** El programa de empresas (B2B) SE MANTIENE y sigue
funcionando, en espera para una futura campaña corporativa. **No se elimina ninguna pantalla ni ruta
de administración de empresas**: la lista blanca de empleados, el login `first-login` y el contenido
de la landing corporativa se conservan en su totalidad, solo se trasladan a `/corporate`.

Éxito (mitad frontend): un visitante escanea el QR, se registra (o entra con Google), recibe una
pantalla de felicitación por su almuerzo de bienvenida, compra un paquete, pide varios platos para
esta semana o la próxima, y los retira en el horario elegido — mientras las pantallas de
administración de empresas existentes siguen funcionando.

## Vocabulario

Los textos orientados al usuario dicen **"almuerzos" (lunches)**, nunca "créditos". El idioma de los
textos de la interfaz es español (idioma existente del producto). El código interno, los nombres de
componentes y los artefactos de SDD permanecen en inglés y conservan el término `credit` donde
corresponda (p. ej. `creditsApi.ts`, `useWallet`).

## Alcance

### Dentro del alcance (frontend)

- **Autorregistro (nuevo)**: pantallas de alta pública con nombre, correo electrónico, teléfono y un
  apodo para mostrar; paso de verificación de correo electrónico; botón **"Iniciar sesión con Google"
  (prioritario)**; pantalla de completar perfil si Google no aporta teléfono/apodo; pantalla de
  felicitación al recibir el almuerzo de bienvenida. El flujo de lista blanca `first-login` existente
  (`EmailStep`/`FirstLoginStep`) no se toca.
- **Billetera de créditos ("mis almuerzos")**: saldo AVAILABLE/COMMITTED visible por separado,
  historial de movimientos, catálogo de paquetes, checkout hacia Mercado Pago.
- **Página de retorno del checkout**: nunca acredita ni afirma acreditación desde el navegador; hace
  polling del estado de la compra y muestra "procesando" hasta que el backend confirme.
- **Pedidos**: carrito multi-ítem, selector de horario de retiro consumiendo los slots que expone el
  backend, costo visible en "almuerzos" (nunca "créditos"), múltiples pedidos por día.
- **División de la landing**: landing pública B2C (historia → registro) como contenido principal en
  la raíz; la sección corporativa se traslada a `/corporate` y se conserva intacta, reutilizando sin
  cambios `QuoteForm`, `LandingNav` y `useScrollReveal`.
- **Administración (UI)**: vista de agrupación de pedidos por horario de retiro, CRUD de paquetes de
  créditos, edición de los campos de configuración nuevos (ventana de retiro, antelación, días de
  vencimiento).
- **Tooling de testing (nuevo)**: se agrega Vitest + Testing Library a `frontend/`, que hoy no cuenta
  con herramientas de testing, junto con el script `npm test`.

### Fuera del alcance (frontend)

- Cualquier lógica de dominio, persistencia, validación de negocio o integración con Mercado
  Pago/Google — todo eso vive en el backend; este cambio solo consume su API.
- Eliminar, migrar o degradar cualquier pantalla o ruta de empresas/B2B.
- Checkout Bricks o cualquier checkout embebido/en el propio sitio (se usa la redirección de Checkout
  Pro).
- Entrega o envío de cualquier tipo.
- Transferencia de créditos entre usuarios (etapa 2).
- Fotografía de platos generada por IA; rediseño de banners (marketing, no código).

## Capacidades

### Capacidades nuevas (frontend)

- `public-landing`: landing B2C dividida y sección `/corporate` conservada.
- `credits-ui`: componentes y pantallas de billetera, paquetes y checkout de créditos — creada en
  esta mitad porque la capacidad `credit-ledger` (saldo, movimientos, vencimiento) y
  `credit-pack-purchase` (paquetes, Mercado Pago) son responsabilidad de dominio del backend; esta
  capacidad cubre únicamente su contraparte de interfaz (ver "Requisitos de UI vs. de dominio" en
  `design.md`).

### Capacidad compartida (requisitos de UI)

- `self-registration`: esta mitad recibe únicamente los requisitos de **flujo de interfaz**
  (formulario de registro, botón de Google, pantalla de felicitación, UX de verificación de correo).
  Los requisitos de dominio/API/verificación/otorgamiento del almuerzo de bienvenida viven en la copia
  de `self-registration` del repositorio backend. Ninguno de los dos lados duplica los requisitos del
  otro.

### Capacidades modificadas

- Ninguna. `frontend/openspec/specs/` está vacío; este es el primer cambio especificado en este
  repositorio.

## Comportamiento existente: modificado vs. sin modificar (frontend)

| Comportamiento existente | Estado |
|---|---|
| Pantallas de administración de empresas, rutas `admin`/`company-admin` | **Sin modificar** — se conservan en espera |
| Contenido de la landing corporativa | **Trasladado** a `/corporate`, contenido conservado |
| `EmailStep`/`FirstLoginStep` (alta por lista blanca) | **Sin modificar** |
| Pedidos de empleados de empresa (UI) | **Sin modificar** en su recorrido; consumen el mismo carrito/selector de retiro que B2C porque el backend enruta ambos por créditos |

## Enfoque

Construir de forma aditiva junto a las pantallas B2B en funcionamiento, en este orden (continúa la
numeración del backend, que se implementa primero):

1. Tooling de Vitest + Testing Library (requisito para todo lo demás).
2. Frontend de autorregistro: formulario, verificación de correo, botón de Google, completar perfil.
3. Frontend de créditos: billetera, paquetes, retorno de checkout.
4. Frontend de pedidos: carrito multi-ítem, selector de horario de retiro.
5. División de la landing/`/corporate` + vistas de administración nuevas (cierre).

Cada unidad de trabajo asume que los endpoints correspondientes del backend ya existen (ver
"Contrato con el backend" en `design.md`).

## Áreas afectadas

| Área | Impacto | Descripción |
|------|--------|-------------|
| `frontend/src/features/credits` | Nuevo | Billetera ("mis almuerzos"), paquetes, redirección/retorno del checkout, historial |
| `frontend/src/features/auth` | Modificado | Flujo de registro, verificación de correo electrónico, inicio de sesión con Google; se conserva el paso de lista blanca |
| `frontend/src/features/orders` | Modificado | Pedidos con múltiples ítems tipo carrito, selector de horario de retiro, costo del almuerzo visible |
| `frontend/src/{features/landing,pages/LandingPage.tsx,routes.tsx}` | Modificado | Landing B2C; sección corporativa trasladada a `/corporate`; se conservan las rutas de administración de empresas |
| `frontend/src/pages/admin/` | Modificado | Agrupación por horario de retiro, CRUD de paquetes, edición de configuración nueva |
| `frontend/` tooling | Nuevo | Configuración de Vitest + Testing Library y script `npm test` |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|------|------------|------------|
| Regresiones de frontend sin cobertura de tests | Alta | Agregar Vitest en este cambio; lint + `tsc -b` + verificaciones manuales |
| El cambio excede el presupuesto de revisión de 400 líneas | Alta | Dividir en unidades de trabajo secuenciales en la fase de tareas |
| Construir contra un contrato de API que todavía no existe o cambia | Alta | No iniciar unidades de trabajo de este cambio hasta que el backend esté implementado; el contrato consumido está documentado en `design.md` |
| La página de retorno del checkout afirma acreditación antes de tiempo | Media | Nunca acreditar desde el frontend; solo polling de `GET /api/v1/credits/purchases/{id}` hasta que el backend confirme `APPROVED` |

## Plan de reversión

Una única rama de funcionalidad, sin despliegue a producción. Revertir = descartar la rama (o hacer
`git revert` del merge). Como el cambio es aditivo, revertirlo deja intactas las pantallas B2B
existentes — no hay datos ni comportamiento de empresas que restaurar.

## Dependencias

- El backend de este mismo cambio (`C:\Arias\backend\openspec\changes\b2c-credits-pivot\`)
  implementado y accesible con los endpoints documentados en "Contrato con el backend".
- Client ID de OAuth de Google para `@react-oauth/google` (el mismo valor configurado en el backend
  como audiencia).
- Vitest + Testing Library agregados a `frontend/`.

## Criterios de éxito (frontend)

- [ ] Las pantallas de administración de empresas existentes siguen funcionando de punta a punta
      después del cambio.
- [ ] No se eliminó ninguna pantalla ni ruta de empresas.
- [ ] Un nuevo visitante puede completar el registro desde el QR, verificar el correo electrónico o
      usar el inicio de sesión con Google, y ve una pantalla de felicitación por su almuerzo de
      bienvenida.
- [ ] La UI permite armar un carrito con múltiples platos, elegir un horario de retiro válido entre
      los que expone el backend, y confirmar el pedido.
- [ ] La vista de administración de pedidos puede agruparse por horario de retiro; el CRUD de
      paquetes y la configuración de vencimiento/ventana son editables desde el panel.
- [ ] Todos los textos de la interfaz dicen "almuerzos", nunca "créditos".
- [ ] La página de retorno del checkout nunca afirma que se acreditaron créditos mientras el estado
      reportado por el backend es `PENDING`.
- [ ] `npm test`, `npm run lint` y `tsc -b` pasan correctamente.

## Puntos abiertos para diseño

- Si el árbol de categorías (`parentId`) necesita algún tratamiento distinto en la UI de catálogo B2C
  frente al B2B — depende de la decisión de diseño del backend sobre `Category.parentId`.
- Copys exactos de la pantalla de felicitación y de los mensajes de verificación de correo pendiente.
- Diseño visual final de `WalletBalance`, `PackCard` y `PurchaseHistory` (fuera del alcance de SDD;
  se resuelve con el equipo de diseño).

## Nota de entrega

La estrategia de entrega es `single-pr` (desarrollador individual, no se abren PRs — se trata como un
único bloque de trabajo). El cambio abarca tooling de testing nuevo más cuatro áreas de frontend
(auth, credits, orders, landing/admin), lo que excede el presupuesto de revisión de 400 líneas, por lo
que se esperan unidades de trabajo secuenciales en la fase de tareas.
