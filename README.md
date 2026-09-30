# Arias — Frontend

Frontend del sistema de pedidos empresariales de Arias (bodegón). La documentación
completa del proyecto (descripción general, stack, funcionalidades, despliegue,
credenciales de prueba, slides y video) vive en el repositorio del backend:

**→ [Arias-Api / README.md](https://github.com/NevadoSantiago/Arias-Api)**

## Stack

React 19 + TypeScript + Vite, Tailwind CSS + shadcn/ui, TanStack React Query, Zustand,
React Hook Form + Zod, React Router, Recharts. Desplegado en Cloudflare Pages.

## Estructura

```
src/
├── features/    # Lógica y componentes por dominio (auth, orders, admin, admin-company,
│                  admin-restaurant, companyAdmin, landing, me, reporting)
├── pages/       # Páginas por rol (admin, admin-company, admin-restaurant, companyAdmin, employee)
├── components/  # Componentes UI compartidos (shadcn/ui en components/ui)
├── layouts/     # Layouts por sección de la app
├── hooks/       # Hooks reutilizables
└── lib/         # Cliente axios, utilidades
```

## Instalación y ejecución en local

Requiere el [backend](https://github.com/NevadoSantiago/Arias-Api) corriendo en
`localhost:8080`.

```bash
npm install
npm run dev
```

Vite levanta en `http://localhost:5173` y proxea `/api` hacia `http://localhost:8080`
(ver `vite.config.ts`), por lo que no hace falta variables de entorno en dev.

En producción, `VITE_API_URL` apunta al dominio del backend.

## Variables de entorno

Ver [`.env.example`](.env.example). Vite las incorpora **en el build**, así que hay que
definirlas antes de `npm run build` / `npm run deploy` (`wrangler.jsonc` no define
ninguna).

| Variable | Uso |
| --- | --- |
| `VITE_API_URL` | Dominio del backend (vacío en dev, usa el proxy de Vite). |
| `VITE_WHATSAPP_NUMBER` | Número de contacto por WhatsApp. |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google para "Continuar con Google". |

En local van en `.env.local` (ignorado por git). En producción se cargan en el entorno
de build de Cloudflare (variables de build del proyecto, o en el shell que corre
`npm run deploy`).

### Login con Google

- `VITE_GOOGLE_CLIENT_ID` tiene que ser el mismo valor que `GOOGLE_CLIENT_ID` del
  backend: el backend valida el ID token contra ese client id.
- En Google Cloud Console, el cliente OAuth "Web application" necesita como **orígenes
  de JavaScript autorizados** el origen de dev (por ejemplo `http://localhost:5174`, el
  puerto en que corre el front en local) y el dominio de producción.
- Sin `VITE_GOOGLE_CLIENT_ID` el botón y su separador no se muestran.
- Solo los clientes B2C pueden entrar con Google; las cuentas de empresa y de
  administración reciben un aviso y siguen por email.

## Despliegue

Cloudflare Pages, vía Wrangler:

```bash
npm run deploy
```
