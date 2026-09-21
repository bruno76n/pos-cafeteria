# POS Cafetería

Punto de venta para una cafetería. Corre en tablet (Android o iPad) como PWA, funciona sin internet y sincroniza con una API propia sobre Neon (Postgres) cuando hay conexión.

- **App:** Vite + React + TypeScript, Tailwind CSS, Zustand, Zod, Dexie (IndexedDB), vite-plugin-pwa.
- **API:** Hono en Vercel Functions, Drizzle ORM, Neon en producción y PGlite (Postgres en WebAssembly) en desarrollo y pruebas.
- **Pruebas:** Vitest (dominio, datos locales con fake-indexeddb, API con PGlite) y Playwright (flujos completos).

Documentación de diseño en `docs/` (especificación, arquitectura, interfaz, plan y bitácora).

## Requisitos

- Node 22 o más nuevo y npm.
- Para las pruebas e2e: Chromium de Playwright (`npx playwright install chromium`).

No hace falta Docker ni una base de datos: en desarrollo la API usa PGlite en `./.pglite`.

## Correrlo

```bash
npm install
npm run seed      # datos demo en la base local (se puede correr varias veces)
npm run dev       # API en :8787 + Vite en :5173 (proxy de /api)
```

Abre la URL que muestra Vite (normalmente http://localhost:5173).

### Cuenta y PINs demo

| | |
|---|---|
| Cuenta del dispositivo | `caja@demo.test` / `demo1234` |
| Dueño (Administrador) | PIN `1234` |
| Encargada | PIN `2222` |
| Cajero | PIN `1111` |

El primer inicio en cada dispositivo pide la cuenta (necesita internet), luego el nombre del dispositivo y la letra de sus folios, y después el PIN. Recargar la app vuelve a pedir el PIN pero conserva la venta en curso.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API local (PGlite en `./.pglite`) + Vite con proxy de `/api` |
| `npm run seed` | Carga datos demo en la base local (idempotente) |
| `npm run crear-cuenta -- correo contraseña` | Crea o reactiva una cuenta (base local, o la de `DATABASE_URL`) |
| `npm run db:generar` | Genera migraciones con drizzle-kit desde `servidor/db/esquema.ts` |
| `npm run db:migrar` | Aplica migraciones (local; con `DATABASE_URL`, en Neon) |
| `npm test` | Pruebas unitarias, de datos locales y de API |
| `npm run test:e2e` | Playwright: levanta una API con base nueva, Vite y un build de producción |
| `npm run typecheck` / `npm run lint` / `npm run format` | TypeScript, ESLint y Prettier |
| `npm run build` / `npm run preview` | Build de producción (PWA con service worker) y servirlo |

Los íconos de la PWA salen de `public/icono.svg`; si lo cambias, regenéralos con `npx tsx scripts/generar-iconos.ts`.

## Cómo está hecho (resumen)

- **Local primero:** las pantallas leen de IndexedDB (Dexie) con `useLiveQuery`. Toda escritura guarda el registro y su operación en una cola de salida en la misma transacción (`src/datos/escrituras.ts`).
- **Sincronización** (`src/datos/sync.ts`): sube la cola en orden (lotes de hasta 100 operaciones o ~1.5 MB) con reintentos crecientes, y baja cambios del servidor paginados por revisión. Reenviar una operación nunca duplica nada. La tablet guarda los últimos 35 días de ventas, movimientos, devoluciones y turnos.
- **Servidor** (`servidor/`): valida cada operación con las reglas de `src/dominio/reglasServidor.ts`. Las ventas nunca se borran y solo cambian estado, cancelación y devuelto.
- **Dinero en centavos enteros**; folios por dispositivo (`A-000123`); fechas con la hora del dispositivo y el día de negocio en `America/Mexico_City`.
- **Impresión** (`src/impresion/`): el ticket es un documento de datos que se dibuja en HTML (vista previa e impresión del sistema) o en ESC/POS (USB o Bluetooth directos).

## Producción (Neon + Vercel)

1. En Neon, crea un proyecto o una rama para el POS y copia su `DATABASE_URL`.
2. Aplica las migraciones: `DATABASE_URL=... npm run db:migrar`.
3. Crea las cuentas de cada tablet y la del dueño: `DATABASE_URL=... npm run crear-cuenta -- caja1@tucafe.mx contraseña-segura`.
4. En Vercel, importa el repositorio (detecta Vite; salida `dist`). En Settings › Environment Variables agrega `DATABASE_URL` y `JWT_SECRET` (una cadena larga y aleatoria, por ejemplo `openssl rand -base64 48`). También puedes conectar Neon con la integración de Vercel para que ponga `DATABASE_URL`.
5. Despliega y abre `https://tu-pos.vercel.app/api/salud`: debe responder `{ "ok": true }`.
6. En la tablet, abre la URL (HTTPS). Android: Chrome › Instalar app. iPad: Safari › Compartir › Agregar a inicio. Inicia sesión **dentro** de la app instalada (tiene su propio almacenamiento), configura el dispositivo y sigue el asistente inicial si la base está vacía.
7. Configuración › Dispositivo › Impresora › "Imprimir prueba".

Cada push a la rama principal redepliega app y API. Si cambia el esquema: `npm run db:generar` en desarrollo, commit de la migración y `npm run db:migrar` contra Neon antes o junto con el despliegue.

## Limitaciones conocidas

- **Permisos por rol solo en la app.** El token es del dispositivo, no de la persona: los permisos de Cajero y Encargado (y el PIN) se aplican en la tablet, no en la API.
- **Depende del reloj del dispositivo.** Las fechas de las ventas y el día de negocio salen de la hora de la tablet; si está mal, los reportes y folios por día lo estarán también.
- **Impresión directa solo en Android/Chrome (o Chrome de escritorio).** WebUSB y Web Bluetooth no existen en iPad; ahí se imprime con el diálogo del sistema (AirPrint o PDF). Por Bluetooth solo funcionan impresoras Bluetooth Low Energy; en Windows el driver del sistema puede acaparar la impresora USB. Los drivers USB y Bluetooth no se han probado con una impresora real.
- **Sincronización "gana el último"** en menú, configuración y usuarios: si dos tablets editan lo mismo sin conexión, queda el cambio más reciente.
- **Reportes de más de 35 días** requieren internet (se consultan al servidor).
