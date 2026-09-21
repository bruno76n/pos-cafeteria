# POS Cafetería — instrucciones para Claude Code

Punto de venta **provisional para una sola cafetería**. Corre en tablet (Android o iPad) como PWA, funciona sin internet y sincroniza con una API propia sobre Neon (Postgres) cuando hay conexión. Debe ser **completo pero sencillo**: la pantalla de venta es lo más importante y tiene que ser rapidísima (2–3 toques para tener el café en la cuenta y pasar al cobro).

## Lee antes de empezar (en este orden)

1. `docs/04-plan.md`: tu lista de tareas. Aquí se decide qué sigue.
2. `docs/bitacora.md`: qué ya se hizo y qué se decidió.
3. `docs/01-especificacion.md`: qué hace cada módulo, reglas de negocio, cálculos y criterios de aceptación.
4. `docs/02-arquitectura.md`: stack, estructura, modelo de datos, reglas offline, seguridad, impresión.
5. `docs/03-interfaz.md`: diseño visual, pantallas y textos.

Después de cada compactación de contexto, vuelve a leer `docs/04-plan.md` y el final de `docs/bitacora.md` antes de seguir. Esos dos archivos son tu memoria.

## Modo de trabajo (sesión desatendida)

Nadie va a contestar preguntas durante la noche. **No preguntes**: decide con criterio siguiendo los docs y anota la decisión en `docs/bitacora.md`.

Trabaja las tareas de `docs/04-plan.md` en orden, una a la vez. Al terminar cada tarea:

1. `npm run typecheck && npm run lint && npm test` sin errores. Si la tarea toca un flujo con prueba e2e, también `npm run test:e2e`.
2. Marca la tarea como `- [x]` en `docs/04-plan.md`.
3. Agrega una línea a `docs/bitacora.md` (qué hiciste, decisiones, pendientes).
4. `git add -A && git commit -m "fase N.M: descripción corta"`.

Si una tarea está bloqueada por algo externo (hardware, servicios reales como Neon o Vercel, algo que no puedes instalar), márcala `- [~]`, escribe el motivo en la bitácora y sigue con la siguiente. No te atores más de ~3 intentos en el mismo problema: busca otro camino o márcala bloqueada.

Si el modo auto bloquea una acción, no insistas con la misma: busca otra forma de lograrlo o marca la tarea como bloqueada. Varios bloqueos seguidos pausan el modo auto y dejarían la sesión esperando a alguien que no está.

No borres, saltes ni debilites pruebas para que pasen. Si una prueba está mal, corrígela y explica por qué en la bitácora.

Al terminar el plan completo, escribe en la sección "Resumen final" de la bitácora: qué quedó, qué probar a mano, qué falta y cómo correrlo.

## Prohibido

- Comandos destructivos de git (`reset --hard`, `clean -fd`, `checkout -- .`, `push --force`, reescribir historia). No hagas `push`.
- Desplegar (`vercel`) o conectarte a bases reales. **Nunca uses `DATABASE_URL` ni te conectes a Neon**: todo se desarrolla y prueba con PGlite local.
- `npm create vite` u otro asistente interactivo en la raíz: la carpeta ya tiene archivos y el asistente podría borrarlos. Arma la configuración a mano.
- `curl | bash` o instalar software del sistema operativo. Si falta algo del sistema, anótalo en la bitácora y avanza con lo que sí se puede.
- Dependencias fuera de la lista de `docs/02-arquitectura.md` sin una razón clara, anotada en la bitácora.

## Stack (detalle en docs/02-arquitectura.md)

App: Vite + React + TypeScript (strict), React Router, Tailwind CSS, Zustand, Zod, Dexie (IndexedDB), vite-plugin-pwa.
Servidor: Hono en Vercel Functions, Drizzle ORM, Neon en producción, PGlite en desarrollo y pruebas.
Pruebas: Vitest, fake-indexeddb y Playwright.

## Comandos (los creas en la Fase 0)

| Comando | Qué hace |
|---|---|
| `npm run dev` | API local (PGlite en `./.pglite`) + Vite con proxy de `/api` |
| `npm run seed` | Carga datos demo en la base local (idempotente) |
| `npm run db:generar` | Genera migraciones con drizzle-kit desde el esquema |
| `npm run db:migrar` | Aplica migraciones (local; en producción lo corre Bruno con `DATABASE_URL`) |
| `npm test` | Pruebas unitarias, de datos locales y de API (Vitest) |
| `npm run test:e2e` | Playwright con API y base local nuevas |
| `npm run typecheck` / `npm run lint` | TypeScript y ESLint |
| `npm run build` / `npm run preview` | Build de producción (PWA) y servirlo |

## Reglas de oro (no negociables)

1. **Dinero en centavos enteros.** Nunca floats para dinero. Formatea solo al mostrar con `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })`.
2. **Local primero:**
   - Las pantallas leen de Dexie con `useLiveQuery`. Nunca esperan a la red para mostrar algo (única excepción: Reportes fuera de los 35 días locales).
   - Toda escritura pasa por `src/datos/escrituras.ts`: registro + operación en la outbox, **en una sola transacción de Dexie**. Nada de `fetch` directo desde pantallas.
   - La red solo la toca el motor de sync (`src/datos/sync.ts`) y el login. Si no hay internet, la app funciona igual.
   - IDs con `crypto.randomUUID()` en el dispositivo. Reenviar una operación nunca debe duplicar nada (el servidor es idempotente).
   - Fechas de negocio con la hora del dispositivo (ISO 8601) más el campo `dia` (`YYYY-MM-DD` en `America/Mexico_City`). El `rev` del servidor es solo para sincronizar.
3. **Folios por dispositivo** (`A-000123`), asignados en la misma transacción que guarda la venta. Nunca un consecutivo global.
4. **Las ventas son inmutables.** Se crean completas; después solo cambian `estado`, `cancelacion` y `devuelto`. Nunca se borran. La API lo hace cumplir.
5. **Cada línea de venta guarda copia** de nombre, precio y modificadores, no referencias vivas al menú.
6. **Permisos:** toda acción sensible pasa por `puede(usuario, permiso)`. Si no tiene permiso, se ofrece autorización con el PIN de otro usuario.
7. **La venta en curso (carrito) se guarda localmente** y sobrevive a recargas y cierres.
8. **UI en español de México**, para tablet horizontal, dedos y prisa. Textos y diseño según `docs/03-interfaz.md`.

## Convenciones de código

- Dominio en español (`Venta`, `Turno`, `calcularCambio`); utilidades técnicas pueden ir en inglés si es más natural (`useColeccion` o `useCollection`, pero sé consistente).
- Lógica de negocio pura en `src/dominio/`: sin React, sin Dexie y sin red, y con pruebas unitarias.
- Acceso a Dexie y a la red solo en `src/datos/`. El servidor vive en `servidor/` y puede importar de `src/dominio/` (esquemas Zod, reglas y cálculos compartidos), nunca de `src/datos/` ni de componentes.
- Sin librerías de componentes (MUI, Chakra, shadcn). Tailwind + componentes propios en `src/componentes/`.
- Pruebas unitarias junto al código (`*.test.ts`); e2e en `e2e/`.
- Commits pequeños, uno por tarea del plan.
