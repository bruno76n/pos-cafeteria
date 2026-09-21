# Kit POS Cafetería para Claude Code

Todo lo necesario para que Claude Code construya el POS en una noche, sin supervisión.

| Archivo | Para qué |
|---|---|
| `CLAUDE.md` | Reglas permanentes que Claude Code lee en cada sesión |
| `docs/01-especificacion.md` | Qué hace cada módulo, cálculos y criterios de aceptación |
| `docs/02-arquitectura.md` | Stack, modelo de datos, offline, seguridad, impresión, despliegue |
| `docs/03-interfaz.md` | Diseño visual, pantallas y textos |
| `docs/04-plan.md` | 92 tareas en 15 fases, con casillas que Claude Code va marcando |
| `docs/bitacora.md` | Donde Claude Code anota avance, decisiones y el resumen final |
| `seed/menu-demo.json` | Menú de ejemplo (5 categorías, 28 productos, 5 grupos de modificadores) |
| `.claude/settings.json` + `.claude/hooks/` | Hook que no lo deja detenerse mientras queden tareas, y bloqueo de push/deploy |

## Antes de dejarlo corriendo

1. **Requisitos en tu compu:** Node 22 o más nuevo; git con `user.name` y `user.email` configurados; Claude Code actualizado (`claude update`) y con tu sesión iniciada. No hace falta Neon ni Docker para la noche: Claude Code desarrolla y prueba con PGlite, un Postgres que corre dentro de Node.
2. Descomprime el zip: crea la carpeta `pos-cafeteria/`. Entra a ella con la terminal y revisa que venga la carpeta oculta `.claude/` (`ls -a`).
3. Arranca Claude Code en modo auto, sin que la Mac se duerma:
   ```bash
   caffeinate -is claude --permission-mode auto
   ```
   Deja la compu conectada a la corriente y con la tapa abierta. (En Windows o Linux, desactiva la suspensión y usa solo `claude --permission-mode auto`.)
4. Si pregunta si confías en la carpeta, di que sí: sin eso no corren los hooks.
5. Con `/model`, elige el modelo más capaz que tengas.
6. Pega el prompt de abajo.
7. **Quédate los primeros 15–20 minutos**, hasta que la Fase 0 quede marcada en `docs/04-plan.md`. Ahí instala dependencias, el Chromium de Playwright y levanta la API local; si algo te pide permiso, apruébalo. Después ya puedes dejarlo.

### El prompt

```
Vas a construir el POS de cafetería descrito en este repositorio. Trabajarás solo durante la noche.

1. Lee CLAUDE.md completo y después docs/04-plan.md, docs/bitacora.md, docs/01-especificacion.md, docs/02-arquitectura.md y docs/03-interfaz.md.
2. Empieza por la tarea 0.1 y sigue el plan en orden, una tarea a la vez, con el ciclo de CLAUDE.md: verificar, marcar [x], anotar en la bitácora y hacer commit.
3. No me hagas preguntas porque no voy a estar. Decide con criterio y anota tus decisiones en la bitácora. Si algo está bloqueado, márcalo [~] con el motivo y continúa.
4. No te detengas al terminar una fase: sigue con la siguiente hasta completar el plan.
5. No hagas push ni deploy, no uses credenciales reales y no uses comandos destructivos de git.

Empieza ahora con la tarea 0.1.
```

## Cómo funciona la noche

- Claude Code avanza tarea por tarea, hace un commit por tarea y anota todo en `docs/bitacora.md`.
- El hook `seguir-si-hay-pendientes.sh` le pide que continúe cada vez que intenta detenerse mientras queden casillas `- [ ]`. Si en 4 intentos seguidos no avanza, lo deja parar (para que no se quede en un ciclo).
- **Para detenerlo:** `touch .claude/DETENER` desde otra terminal, o Esc / Ctrl+C en la suya.
- Si topa el límite de uso de tu plan, se detiene. Para retomarlo: `caffeinate -is claude --continue --permission-mode auto` y escribe "Sigue con docs/04-plan.md donde te quedaste."
- Son 92 tareas: es posible que no termine todo en una noche. El orden está pensado para que lo primero que quede sea vender, cobrar, imprimir y cuadrar la caja.

## En la mañana

1. Lee el "Resumen final" (o las últimas líneas) de `docs/bitacora.md` y revisa `git log --oneline`.
2. `npm run seed` (si la base local está vacía) y `npm run dev`. Abre la URL que muestre Vite (normalmente http://localhost:5173).
3. Cuenta demo: `caja@demo.test` / `demo1234`. PINs: Dueño 1234, Encargada 2222, Cajero 1111.
4. Prueba el flujo completo: abrir caja, vender un latte mediano con almendra, cobrar en efectivo, registrar un gasto y cerrar caja.
5. `npm test` y `npm run test:e2e` deberían pasar. Para ver la sincronización, abre la app en dos navegadores distintos: lo que vendes en uno aparece en el otro en unos segundos.

## Probarlo en la tablet real

La impresión directa (USB/Bluetooth) y el funcionamiento sin internet (service worker) solo funcionan con HTTPS, así que en la tablet se prueba ya desplegado en Vercel. Los pasos están en `docs/02-arquitectura.md` §15. En resumen:

1. Crea una rama o proyecto en Neon.
2. Corre las migraciones con `npm run db:migrar`.
3. Crea las cuentas con `npm run crear-cuenta`.
4. Importa el repo en Vercel con `DATABASE_URL` y `JWT_SECRET`.
5. Revisa que `/api/salud` responda.

- **Android:** Chrome › Instalar app. Aquí funcionan USB y Bluetooth (solo impresoras Bluetooth Low Energy).
- **iPad:** Safari › Compartir › Agregar a inicio. Solo imprime con el diálogo del sistema (AirPrint o PDF); USB y Bluetooth directos no existen en navegadores de iPad.

Cuando sepas qué impresora va a usar la cafetería, dímelo y ajustamos el driver.

## Decisiones respecto a tu plan original

- **Vite en lugar de Next.js:** aquí no hay SEO ni servidor, y una SPA con un solo `index.html` es lo más confiable para que la caja arranque sin internet.
- **Neon en lugar de Firebase:** la tablet guarda todo en IndexedDB y una cola de salida lo sube a una API propia (Hono en Vercel Functions) que escribe en Neon. La API aplica las reglas del servidor: las ventas no se borran y solo cambian estado, cancelación y devuelto.
- **Vercel sirve la app y la API:** un solo despliegue.
- **PIN por usuario** sobre una cuenta por dispositivo (token de 1 año), **folios por dispositivo** (`A-000123`) y **corte ciego** (el cajero cuenta antes de ver el esperado).
- **Agregué el permiso "Aplicar descuentos"** a tu lista, y "Cambio para caja" se registra como entrada, no como gasto.
