# Bitácora

Claude Code: agrega una línea por cada tarea terminada o bloqueada, en orden cronológico. Formato:

`AAAA-MM-DD HH:MM | tarea | hecho / bloqueado | qué hiciste, qué decidiste, qué falta`

Las decisiones que cambien algo de los docs van también en "Decisiones", con el porqué.

## Entorno

Node v26.0.0 · npm 11.12.1 · git 2.50.1 · macOS 26.4 (arm64). No falta nada del sistema.

## Registro

0.1 | hecho | versiones anotadas en Entorno.
0.2 | hecho | git init, .gitignore y primer commit con los docs.

## Decisiones

## Para probar a mano (Bruno)

- Impresión con la impresora real (USB o Bluetooth, en Android con Chrome).
- Instalación como app en la tablet real (Android: Chrome › Instalar app; iPad: Safari › Compartir › Agregar a inicio).
- Neon real: migraciones y cuentas (`npm run db:migrar`, `npm run crear-cuenta`).
- Despliegue en Vercel: adaptador de `api/`, variables `DATABASE_URL` y `JWT_SECRET`, `/api/salud`.

## Resumen final

(al terminar el plan: qué quedó, qué probar primero, qué falta, cómo correrlo)
