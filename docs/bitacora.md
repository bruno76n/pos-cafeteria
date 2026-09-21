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
1.10 | hecho | reglasServidor.ts (evaluarOperacion: insertar/upsert último-gana/actualizar campos permitidos/borrar), auth.ts (jose HS256 1 año, bcryptjs, límite 5 intentos por IP), rutas acceso, sync/push (idempotente, 2 MB, 100 ops), sync/pull (500 por página, 35 días, lápidas) y reportes (máx. 92 días); 38 pruebas de API.
1.11 | hecho | menuEjemplo.ts (menú y config de ejemplo + roles por defecto), seed.ts idempotente (cuenta demo, config, 3 usuarios con PIN, menú), crear-cuenta.ts; e2e siembra su base temporal; prueba de doble seed.
1.12 | hecho | bd.ts (Dexie: tablas + outbox ordenada, meta tipada, erroresSync), escrituras.ts (crear/guardar/actualizar/borrar/registrarVenta con folio, todo en una transacción; aviso al sync) y consultas.ts (hooks useLiveQuery); pruebas con fake-indexeddb.
1.13 | hecho | api.ts (ErrorApi red/sesión/petición), sync.ts (MotorSync: push por lotes de 100 en orden, espera 5/15/30/60 s, 401 sin perder outbox, rechazadas a erroresSync, pull paginado que no pisa pendientes, contador de folios que no retrocede, limpieza diaria de 35 días, disparadores), estadoSync.ts y erroresSync.ts; 20 pruebas con servidor simulado.
1.14 | hecho | integracion.test.ts: Dexie (fake-indexeddb) + api.ts real con fetch enrutado a la app Hono con PGlite sembrada; dispositivo A vende y sube, B hace pull y recibe venta, turno y contador.
2.1 | hecho | Shell: barra superior (negocio, dispositivo, conexión, usuario con Cambiar usuario/Bloquear), riel lateral y barra inferior con Más en vertical, pestañas por sección, rutas con guardas (sesión → primer pull → dispositivo → bienvenida → PIN → permiso) y pantallas vacías; componentes Boton, Campo, Hoja, Pantalla, Pestanas.

## Decisiones
- TypeScript 6.0 y no 7: typescript-eslint aún exige <6.1.
- Se agregan @eslint/js y globals (dev): los necesita la config plana de ESLint.
- e2e usa puertos 8797/5197 para no chocar con otros servidores locales (5173 ya estaba ocupado en esta Mac).
- IDs como texto (no uuid): el menú demo usa ids legibles ('latte', 'cafes'); los nuevos registros siguen usando crypto.randomUUID().
- Todo registro sincronizable lleva actualizadoEn; config se guarda como { id: 'general', datos }.
- Tope de descuento en monto: no puede pasar de descuentoMaximoPorcentaje % del subtotal (mismo tope que en porcentaje).
- Tabla extra operaciones_aplicadas: guarda el id de cada operación para que reenviarla sea idempotente también en 'actualizar'.
- Categorías, grupos y productos se borran con borrado=true (lápida) para que el borrado llegue a los otros dispositivos por el pull.
- Grupos de modificadores también se pueden borrar (lápida), igual que categorías y productos: las ventas guardan copia.
- El guardián espera el primer pull antes de configurar el dispositivo: así el prefijo y el contador de folios se validan con lo que hay en el servidor.
- Dispositivos de consulta no muestran Nueva venta.

## Para probar a mano (Bruno)

- Impresión con la impresora real (USB o Bluetooth, en Android con Chrome).
- Instalación como app en la tablet real (Android: Chrome › Instalar app; iPad: Safari › Compartir › Agregar a inicio).
- Neon real: migraciones y cuentas (`npm run db:migrar`, `npm run crear-cuenta`).
- Despliegue en Vercel: adaptador de `api/`, variables `DATABASE_URL` y `JWT_SECRET`, `/api/salud`.

## Resumen final

(al terminar el plan: qué quedó, qué probar primero, qué falta, cómo correrlo)
