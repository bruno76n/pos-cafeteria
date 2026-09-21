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
1.2 | hecho | esquemas.ts (Zod 4) de todas las entidades, operaciones de sync y acceso; tipos.ts derivado con z.infer; pruebas válidas e inválidas.
1.3 | hecho | fechas.ts solo con Intl: diaLocal, inicio/fin de día (con DST), rangos Hoy/Ayer/Semana (lunes)/Mes, formatos; pruebas con cruce de medianoche UTC.
1.4 | hecho | modificadores.ts: selección por defecto, alternar con tope, validación obligatorio/mín./máx., precio unitario, resumen y clave; datosPrueba.ts desde el menú demo; caso J.
1.5 | hecho | carrito.ts: líneas con copia, fusión de idénticas, cantidad (0 elimina), editar, nota, cliente, descuento con tope, totales con IVA incluido/no incluido; casos A, B, C y G.
1.6 | hecho | cobro.ts: pagos combinados, pendiente, cambio solo del efectivo, un pago por método, referencia obligatoria, billetes sugeridos; casos D, E, F y G.
1.7 | hecho | caja.ts (resumen de turno, efectivo esperado, diferencia, denominaciones, agregados por producto/categoría/cajero) y devoluciones.ts (reembolso proporcional con tope, estado resultante); casos H e I.
1.8 | hecho | folios.ts (formato, siguiente, contador inicial, prefijo en uso), permisos.ts (roles por defecto, puede, nombres) y pin.ts (SHA-256 con sal, Web Crypto, búsqueda por PIN, PIN en uso).
1.9 | hecho | esquema.ts con todas las tablas (rev de la secuencia rev_global, actualizado_en, índices, folio único), cuentas y operaciones_aplicadas; migración 0000_inicial; migrar.ts para PGlite/Neon; dev-api migra al arrancar; pruebas desde cero.

## Decisiones
- TypeScript 6.0 y no 7: typescript-eslint aún exige <6.1.
- Se agregan @eslint/js y globals (dev): los necesita la config plana de ESLint.
- e2e usa puertos 8797/5197 para no chocar con otros servidores locales (5173 ya estaba ocupado en esta Mac).
- IDs como texto (no uuid): el menú demo usa ids legibles ('latte', 'cafes'); los nuevos registros siguen usando crypto.randomUUID().
- Todo registro sincronizable lleva actualizadoEn; config se guarda como { id: 'general', datos }.
- Tope de descuento en monto: no puede pasar de descuentoMaximoPorcentaje % del subtotal (mismo tope que en porcentaje).
- Tabla extra operaciones_aplicadas: guarda el id de cada operación para que reenviarla sea idempotente también en 'actualizar'.
- Categorías, grupos y productos se borran con borrado=true (lápida) para que el borrado llegue a los otros dispositivos por el pull.

## Para probar a mano (Bruno)

- Impresión con la impresora real (USB o Bluetooth, en Android con Chrome).
- Instalación como app en la tablet real (Android: Chrome › Instalar app; iPad: Safari › Compartir › Agregar a inicio).
- Neon real: migraciones y cuentas (`npm run db:migrar`, `npm run crear-cuenta`).
- Despliegue en Vercel: adaptador de `api/`, variables `DATABASE_URL` y `JWT_SECRET`, `/api/salud`.

## Resumen final

(al terminar el plan: qué quedó, qué probar primero, qué falta, cómo correrlo)
