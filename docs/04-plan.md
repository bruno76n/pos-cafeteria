# 04 · Plan de trabajo

Recorre las tareas **en orden**. Marca `- [x]` al terminar (con el ciclo de `CLAUDE.md`) o `- [~]` si está bloqueada (motivo en la bitácora). El orden está pensado para que, si la noche no alcanza, lo que quede hecho sea lo más importante: vender, cobrar, imprimir y cuadrar la caja.

Cada tarea incluye su criterio de terminado después de "→".

## Fase 0: Preparación del proyecto

- [x] 0.1 Verifica el entorno: `node -v` (≥ 22) y `git --version`. Anota versiones en la bitácora. → Anotado.
- [x] 0.2 `git init` si no existe. `.gitignore` con `node_modules`, `dist`, `coverage`, `playwright-report`, `test-results`, `.pglite`, `.vercel`, `*.log`, `.env*.local`, `.claude/.hook-estado`, `.claude/DETENER`. Primer commit con los docs. → `git log` muestra el commit.
- [x] 0.3 Proyecto Vite + React + TypeScript armado a mano (sin asistentes): `package.json`, `index.html` (lang `es-MX`), `vite.config.ts`, `tsconfig*.json` (strict, que incluya `src/`, `servidor/`, `api/` y `scripts/`), `src/main.tsx`, `src/App.tsx`, alias `@/` → `src/`. → `npm run dev` sirve una página.
- [x] 0.4 Tailwind CSS v4 (`@tailwindcss/vite`), tokens de `docs/03-interfaz.md` en `src/estilos/global.css` y fuente autoalojada. → Página de prueba con los colores y la fuente.
- [x] 0.5 ESLint (typescript-eslint, react-hooks) + Prettier. Scripts `lint`, `typecheck`, `format`. → Los tres corren sin errores.
- [x] 0.6 Vitest (entornos `jsdom` para la app y `node` para el servidor) con una prueba trivial de cada uno. Script `test`. → `npm test` pasa.
- [x] 0.7 Servidor mínimo: `servidor/app.ts` (Hono con `GET /api/salud`), `servidor/db/cliente.ts` (PGlite si no hay `DATABASE_URL`, Neon HTTP si hay), `drizzle.config.ts`, `scripts/dev-api.ts` (@hono/node-server en 8787 + PGlite en `./.pglite`), proxy de `/api` en Vite, `.env.development` y `.env.example`. Script `dev` con `concurrently`. → Con `npm run dev`, `http://localhost:5173/api/salud` responde `{ ok: true }`.
- [x] 0.8 `api/[[...ruta]].ts` con el adaptador de Hono para Vercel y `vercel.json` (`docs/02-arquitectura.md` §12). → Compila (no se despliega).
- [ ] 0.9 Playwright con Chromium (`npx playwright install chromium`), viewport 1280×800, `webServer` que levanta la API con una base PGlite nueva en carpeta temporal + Vite; una prueba que abre la app y consulta `/api/salud`. Script `test:e2e`. → `npm run test:e2e` pasa.
- [ ] 0.10 Scripts `seed` (vacío por ahora), `db:generar`, `db:migrar`, `build`, `preview`. → `npm run build` y `npm test` pasan. Commit.

## Fase 1: Dominio, datos y sincronización

- [ ] 1.1 `dominio/dinero.ts`: centavos, redondeo, formato MXN, lectura de captura ("12.5" → 1250). → Pruebas.
- [ ] 1.2 `dominio/tipos.ts` y `dominio/esquemas.ts` (Zod) para todas las entidades de `docs/02-arquitectura.md` §5. → Pruebas con documentos válidos e inválidos.
- [ ] 1.3 `dominio/fechas.ts`: `diaLocal()` en America/Mexico_City, inicio y fin de día, rangos Hoy/Ayer/Esta semana/Este mes, formato `dd/mm/aaaa HH:mm`. → Pruebas, incluido el cruce de medianoche UTC.
- [ ] 1.4 `dominio/modificadores.ts`: opciones por defecto, validación (obligatorio, mín., máx.), precio unitario, resumen legible. → Pruebas (caso J).
- [ ] 1.5 `dominio/carrito.ts`: agregar con fusión de líneas idénticas, cantidad, eliminar, nota, cliente, descuento (% y monto, tope), totales con IVA incluido y no incluido. → Pruebas (casos A, B, C, G).
- [ ] 1.6 `dominio/cobro.ts`: pagos combinados, pendiente, cambio, validaciones (un pago por método, solo efectivo excede). → Pruebas (casos D, E, F).
- [ ] 1.7 `dominio/caja.ts` y `dominio/devoluciones.ts`: resumen de turno, efectivo esperado, diferencia, reembolso proporcional. → Pruebas (casos H, I).
- [ ] 1.8 `dominio/folios.ts`, `dominio/permisos.ts` (roles por defecto, `puede`) y `dominio/pin.ts` (hash con sal, Web Crypto). → Pruebas.
- [ ] 1.9 `servidor/db/esquema.ts` (Drizzle: todas las tablas de §5 con `rev`, `actualizado_en`, índices y secuencia `rev_global`), primera migración con `db:generar` y `servidor/db/migrar.ts` para PGlite y Neon. → Migración aplicada en PGlite desde cero.
- [ ] 1.10 `dominio/reglasServidor.ts` (qué operación se permite en qué tabla, §6) y rutas `POST /api/acceso`, `POST /api/sync/push`, `GET /api/sync/pull` y `GET /api/reportes`, con JWT (`jose`) y bcrypt. → Pruebas de API con PGlite en memoria (casos de §11).
- [ ] 1.11 `scripts/seed.ts` (idempotente) y `scripts/crear-cuenta.ts`: cuenta `caja@demo.test`/`demo1234`, configuración (armada con `negocio` y `configInicial` del JSON más los roles por defecto de `dominio/permisos.ts`), usuarios demo con PIN, categorías, grupos y productos de `seed/menu-demo.json`. → `npm run seed` dos veces seguidas sin duplicar nada.
- [ ] 1.12 `src/datos/bd.ts` (Dexie con las mismas tablas + `outbox`, `meta`, `erroresSync`), `escrituras.ts` (registro + outbox en una transacción) y hooks de consulta con `useLiveQuery`. → Pruebas con `fake-indexeddb`.
- [ ] 1.13 `src/datos/sync.ts`: push por lotes con reintentos y espera creciente; manejo de `aplicada`, `duplicada` y `rechazada`; 401 sin perder la outbox; pull paginado por `rev` que no pisa registros pendientes; alcance de 35 días y limpieza diaria. `estadoSync.ts` y `erroresSync.ts`. → Pruebas contra un servidor simulado (red caída, 5xx, 401, rechazo, duplicado, orden).
- [ ] 1.14 Prueba de integración: la app (Dexie con `fake-indexeddb`) sincroniza contra la API real con PGlite: crear venta local → push → otro "dispositivo" hace pull y la recibe. → Pasa.

## Fase 2: Acceso y estructura

- [ ] 2.1 Shell: barra superior (negocio, dispositivo, conexión, usuario), riel lateral con las secciones permitidas, pestañas de subsección y rutas con guardas (`docs/02-arquitectura.md` §3). → Navegación completa con pantallas vacías.
- [ ] 2.2 Pantalla de acceso (correo y contraseña contra `/api/acceso`, token guardado en Dexie) con errores claros, incluido el de primer inicio sin internet y el de sesión expirada. → Entra con la cuenta demo; tras recargar sin red sigue dentro.
- [ ] 2.3 Configuración del dispositivo: nombre, tipo, prefijo único; guarda en Dexie y se sincroniza; inicializa el contador de folios con lo que haya en el servidor. → Persiste tras recargar.
- [ ] 2.4 Asistente inicial cuando no existe configuración (ni local ni en el servidor tras el primer pull): nombre del negocio, Administrador con PIN y "Cargar menú de ejemplo" (JSON empaquetado, sin usuarios demo). → Probado con una base vacía.
- [ ] 2.5 Bloqueo con PIN (teclado propio, espera tras 5 fallos), cambiar usuario, bloquear, bloqueo automático por inactividad. → Recargar pide PIN.
- [ ] 2.6 `RequierePermiso` y `pedirAutorizacion(permiso)`. → Probado con un cajero.
- [ ] 2.7 Indicador de conexión y ventas por subir; aviso persistente de errores de sincronización con "Reintentar". → Visible sin conexión.
- [ ] 2.8 e2e: acceso + PIN + cambio de usuario; el cajero no ve Reportes ni Configuración. → Pasa.

## Fase 3: Abrir caja y nueva venta

- [ ] 3.1 Abrir caja (fondo inicial, un turno abierto por dispositivo) y bloqueo de la venta sin caja abierta. → El turno llega a la base tras el push.
- [ ] 3.2 Nueva venta: pestañas de categoría, cuadrícula de productos, no disponibles apagados, buscador sin acentos. → Según `docs/03-interfaz.md`.
- [ ] 3.3 Hoja de personalización: opciones por defecto, validación, nota, cantidad, precio en el botón. → Caso J en la UI.
- [ ] 3.4 Carrito: líneas, + / −, eliminar, editar línea, nota, "Para:", vaciar con confirmación, guardado local. → Sobrevive a recargar.
- [ ] 3.5 Descuento a la venta con permiso o autorización y tope de configuración. → Probado con cajero y encargado.
- [ ] 3.6 Totales con IVA según configuración. → Coinciden con el caso B.
- [ ] 3.7 e2e: abrir caja, armar venta con modificadores y descuento, recargar y el carrito sigue. → Pasa.

## Fase 4: Cobro

- [ ] 4.1 Capa de cobro: total, pagos, pendiente, métodos activos, "Volver a la venta". → Navegación sin perder el carrito.
- [ ] 4.2 Efectivo: exacto, billetes rápidos, teclado numérico, cambio. → Caso D.
- [ ] 4.3 Tarjeta y transferencia (datos bancarios, referencia, confirmación). → Según `docs/01-especificacion.md` §5.3.
- [ ] 4.4 Pago combinado y total en cero. → Casos E, F y G.
- [ ] 4.5 Confirmar: folio y venta en la misma transacción de Dexie (con su operación en la outbox), copia completa del carrito; vuelta a Nueva venta con el resultado (cambio grande). → La venta llega a la base con folio correcto.
- [ ] 4.6 e2e: presupuesto de toques (`docs/01-especificacion.md` §7), efectivo con cambio y pago combinado. → Pasa.

## Fase 5: Ticket e impresión

- [ ] 5.1 `impresion/ticket.ts`: `TicketDocumento`, `construirTicketVenta` y `construirTicketCorte` (32 y 48 columnas, reimpresión, cancelada). → Pruebas de snapshot.
- [ ] 5.2 Vista previa HTML e impresión por navegador (58 y 80 mm). → Se ve como el ejemplo de `docs/01-especificacion.md` §5.4.
- [ ] 5.3 `impresion/escpos.ts` con `@point-of-sale/receipt-printer-encoder`: acentos, logo, QR opcional, corte. → Pruebas de los bytes clave.
- [ ] 5.4 Drivers USB y Bluetooth con detección, conectar, reconectar, imprimir y errores claros. → Compila y se ofrece solo donde hay soporte. Anota "Probar con impresora real".
- [ ] 5.5 Configuración de impresora por dispositivo, "Imprimir prueba" e impresión automática al cobrar. → Con el driver de navegador funciona de punta a punta.
- [ ] 5.6 Ticket digital: compartir el texto (Web Share; si no hay, copiar o abrir WhatsApp). → Botón en el resultado de la venta y en el detalle.

## Fase 6: Caja completa

- [ ] 6.1 Caja actual: resumen en vivo; efectivo esperado solo con `verReportes`. → Coincide con `dominio/caja.ts`.
- [ ] 6.2 Movimientos: entradas, retiros y gastos con categoría; anular. → Suman o restan correctamente.
- [ ] 6.3 Cerrar caja: conteo por denominaciones o total, corte ciego, diferencia, nota, resumen guardado. → Turno cerrado con `resumen`.
- [ ] 6.4 Imprimir corte. → Vista previa correcta.
- [ ] 6.5 Cortes de caja: historial y detalle con reimpresión. → Lista los cortes.
- [ ] 6.6 e2e: abrir, vender, registrar gasto, cerrar con faltante; el corte muestra la diferencia correcta. → Pasa.

## Fase 7: Menú

- [ ] 7.1 Categorías: crear, editar (nombre y color), orden, activar/desactivar, eliminar solo sin productos. → Cambios visibles al instante en Nueva venta.
- [ ] 7.2 Grupos de modificadores: CRUD con opciones, precio extra, por defecto, disponible, tipo, obligatorio, mín./máx. → Se reflejan en la hoja de personalización.
- [ ] 7.3 Productos: lista con filtros, crear/editar (imagen comprimida, precio solo con `modificarPrecios`, grupos en orden), disponible, orden, eliminar. → Según `docs/01-especificacion.md` §5.5.
- [ ] 7.4 e2e: crear categoría y producto con modificadores y venderlo. → Pasa.

## Fase 8: Historial, cancelaciones y devoluciones

- [ ] 8.1 Historial con filtros (fechas, método, cajero, estado, folio) e insignias de estado y "Por subir". → Según `docs/03-interfaz.md`.
- [ ] 8.2 Detalle con vista del ticket, reimprimir (marca de reimpresión) y compartir. → Funciona.
- [ ] 8.3 Cancelar venta (turno abierto, motivo, permiso o autorización). → La venta deja de contar en la caja.
- [ ] 8.4 Devolución total o parcial (reembolso proporcional, método, turno) y lista de Devoluciones. → Caso I; el efectivo esperado se ajusta.
- [ ] 8.5 e2e: cancelar y devolver. → Pasa.

## Fase 9: Usuarios y permisos

- [ ] 9.1 Usuarios: crear, editar, rol, PIN único con confirmación, activar/desactivar, protección del último Administrador. → Reglas de `docs/01-especificacion.md` §5.11.
- [ ] 9.2 Roles y permisos: matriz editable para Encargado y Cajero. → Cambios efectivos de inmediato.
- [ ] 9.3 e2e: quitar un permiso al cajero y comprobar que pide autorización. → Pasa.

## Fase 10: Configuración

- [ ] 10.1 Negocio (logo comprimido, datos, categorías de gasto). → Se ven en el ticket.
- [ ] 10.2 Impuestos y descuentos. → Totales y ticket cambian según la configuración.
- [ ] 10.3 Pagos (métodos, cuentas bancarias, referencia obligatoria). → Se reflejan en el cobro.
- [ ] 10.4 Ticket (ancho, campos visibles, mensaje, imprimir al cobrar) con vista previa en vivo. → Funciona.
- [ ] 10.5 Dispositivo (nombre, prefijo, tipo, bloqueo automático, estado del almacenamiento persistente). → Funciona.

## Fase 11: Inicio y reportes

- [ ] 11.1 Inicio según permisos (`docs/01-especificacion.md` §5.1). → Cifras correctas en vivo.
- [ ] 11.2 Reportes: selector de rango y pestaña Resumen con barras por hora o día. → Cifras correctas.
- [ ] 11.3 Pestañas Productos, Categorías, Cajeros y Cortes. → Cifras correctas.
- [ ] 11.4 Exportar CSV (UTF-8 con BOM). → Abre bien con acentos.
- [ ] 11.5 e2e: las cifras de Reportes coinciden con ventas conocidas creadas en la prueba. → Pasa.

## Fase 12: PWA y robustez offline

- [ ] 12.1 `vite-plugin-pwa`: manifest, íconos generados desde un SVG propio, precache, aviso de actualización que nunca recarga con el carrito lleno. → `npm run build` genera el service worker.
- [ ] 12.2 `navigator.storage.persist()` y su estado en Configuración › Dispositivo. → Visible.
- [ ] 12.3 e2e offline: sin red, vender; con red, verificar que la venta llegó a la base. e2e dos dispositivos: lo que vende uno aparece en el otro tras el pull. → Pasan.
- [ ] 12.4 e2e PWA: build + preview, cargar, quitar la red, recargar; la app abre y deja vender. → Pasa.
- [ ] 12.5 Revisión final de las reglas del servidor, índices del esquema y tamaño de lotes contra el código real; `/api` excluido del service worker. → Pruebas de API pasan.

## Fase 13: Pulido y entrega

- [ ] 13.1 Revisión responsive: 1280×800, 1180×820, 1024×768, vertical y celular (Inicio y Reportes). Toma capturas con Playwright y corrige. → Sin desbordes ni textos cortados.
- [ ] 13.2 Estados vacíos, de error y de carga con los textos de `docs/03-interfaz.md` §5. → Revisados en todas las pantallas.
- [ ] 13.3 Accesibilidad básica: foco visible, contraste, etiquetas, `prefers-reduced-motion`. → Revisado.
- [ ] 13.4 `README.md` del repo: requisitos, cómo correr, cuentas y PINs demo, pruebas, despliegue en Neon y Vercel (`docs/02-arquitectura.md` §15) y limitaciones conocidas (permisos por rol solo en la app; depende del reloj del dispositivo; impresión directa solo en Android/Chrome). → Completo.
- [ ] 13.5 Resumen final en la bitácora para Bruno. → Escrito.

## Fase 14: Opcionales (solo si todo lo anterior está completo)

- [ ] 14.1 QR en el ticket con enlace a un ticket público `/t/:id` (ruta `GET /api/tickets/:id` sin token que solo devuelve esa venta por su UUID, con pruebas).
- [ ] 14.2 Marcar un producto como no disponible desde Nueva venta con pulsación larga (requiere `crearProductos`).
- [ ] 14.3 Tema oscuro con los mismos tokens.
