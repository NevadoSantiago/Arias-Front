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

## Despliegue

Cloudflare Pages, vía Wrangler:

```bash
npm run deploy
```
