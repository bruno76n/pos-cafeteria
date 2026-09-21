# Bitácora

Claude Code: agrega una línea por cada tarea terminada o bloqueada, en orden cronológico. Formato:

`AAAA-MM-DD HH:MM | tarea | hecho / bloqueado | qué hiciste, qué decidiste, qué falta`

Las decisiones que cambien algo de los docs van también en "Decisiones", con el porqué.

## Entorno

Node v26.0.0 · npm 11.12.1 · git 2.50.1 · macOS 26.4 (arm64). No falta nada del sistema.

## Registro

0.1 | hecho | versiones anotadas en Entorno.
0.2 | hecho | git init, .gitignore y primer commit con los docs.
0.3 | hecho | Vite 8 + React 19 + TS 6 strict a mano; alias @/; tsconfig único con src, servidor, api, scripts y e2e.
0.4 | hecho | Tailwind v4 con @tailwindcss/vite, tokens en @theme de global.css, Atkinson Hyperlegible Next autoalojada (Fontsource variable).
0.5 | hecho | ESLint 10 (flat, typescript-eslint, react-hooks) + Prettier; scripts lint, typecheck, format.
0.6 | hecho | Vitest 5 con proyectos app (jsdom) y servidor (node); prueba trivial en cada uno (se reemplazan con pruebas reales).
0.7 | hecho | Hono con /api/salud y crearApp(deps) inyectable; cliente.ts elige Neon HTTP o PGlite; dev-api en 8787; proxy de Vite; concurrently. Prueba de salud reemplaza la trivial del servidor.
0.8 | hecho | api/[[...ruta]].ts con hono/vercel (GET y POST, conexión perezosa a Neon) y vercel.json con reescritura SPA y caché; compila, no se despliega.
0.9 | hecho | Playwright + Chromium, 1280×800 táctil, zona America/Mexico_City; webServer con API (PGlite temporal nueva) en 8797 y Vite en 5197; prueba de arranque.
0.10 | hecho | Scripts build, preview, seed (vacío), db:generar (drizzle-kit) y db:migrar (servidor/db/migrar.ts para PGlite y Neon).
1.1 | hecho | dinero.ts: redondeo mitad arriba, formato MXN, formato corto, lectura de captura y pruebas.

## Decisiones
- TypeScript 6.0 y no 7: typescript-eslint aún exige <6.1.
- Se agregan @eslint/js y globals (dev): los necesita la config plana de ESLint.
- e2e usa puertos 8797/5197 para no chocar con otros servidores locales (5173 ya estaba ocupado en esta Mac).

## Para probar a mano (Bruno)

- Impresión con la impresora real (USB o Bluetooth, en Android con Chrome).
- Instalación como app en la tablet real (Android: Chrome › Instalar app; iPad: Safari › Compartir › Agregar a inicio).
- Neon real: migraciones y cuentas (`npm run db:migrar`, `npm run crear-cuenta`).
- Despliegue en Vercel: adaptador de `api/`, variables `DATABASE_URL` y `JWT_SECRET`, `/api/salud`.

## Resumen final

(al terminar el plan: qué quedó, qué probar primero, qué falta, cómo correrlo)
