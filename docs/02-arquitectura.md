# 02 · Arquitectura

## 1. Decisiones clave (y por qué)

| Decisión | Por qué |
|---|---|
| **Vite + React (SPA)**, no Next.js | No hay SEO. La caja tiene que arrancar sin internet, y una SPA con un solo `index.html` precacheado por el service worker es lo más confiable. |
| **Neon (Postgres)** como base de datos en la nube | Bruno ya lo usa. SQL relacional encaja con ventas, turnos y reportes. |
| **IndexedDB (Dexie) en la tablet como fuente de verdad local** + sincronización propia | Postgres no se puede usar sin conexión desde el navegador. La tablet guarda todo localmente al instante y una cola de salida (outbox) lo sube cuando hay internet. |
| **API propia en Vercel Functions (Hono + Drizzle)** | El navegador nunca habla directo con la base de datos (no se exponen credenciales). La API valida y aplica las reglas de negocio del servidor: nada se borra y las ventas solo cambian ciertos campos. |
| **Cuenta por dispositivo con token + usuarios internos con PIN** | La tablet inicia sesión una vez y guarda un token; los cajeros cambian con PIN, que funciona sin internet. |
| **Vercel** sirve la app y la API | Un solo despliegue: archivos estáticos en `dist/` y funciones en `api/`. |
| **PGlite** (Postgres en WebAssembly) para desarrollo y pruebas | Claude Code puede desarrollar y probar toda la noche sin Docker, sin Java y sin credenciales reales. |
| **Impresión con drivers intercambiables** | Aún no sabemos qué impresora habrá. En iPad un navegador no puede usar USB ni Bluetooth; en Android sí. |

## 2. Dependencias

**App (producción):** `react`, `react-dom`, `react-router`, `dexie`, `dexie-react-hooks`, `zustand`, `zod`, `lucide-react`, `@point-of-sale/receipt-printer-encoder`, `@point-of-sale/webusb-receipt-printer`, `@point-of-sale/webbluetooth-receipt-printer` y la fuente autoalojada (ver `03-interfaz.md`).

**Servidor (producción):** `hono`, `drizzle-orm`, `@neondatabase/serverless`, `jose` (JWT), `bcryptjs`, `zod`.

**Desarrollo:** `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `vite-plugin-pwa`, `vitest`, `jsdom`, `fake-indexeddb`, `@testing-library/react` (si hace falta), `@playwright/test`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`, `drizzle-kit`, `@electric-sql/pglite`, `@hono/node-server`, `tsx`, `concurrently`.

Usa las versiones estables actuales. **No agregues:** librerías de componentes, React Query, un ORM distinto, date-fns/moment (usa `Intl`), lodash, otro gestor de estado, ni motores de sincronización de terceros.

Para `@point-of-sale/*` y el adaptador de Hono para Vercel consulta la documentación actual (README en `node_modules` o sitio oficial) antes de usarlos.

## 3. Estructura de carpetas

```
/
├── CLAUDE.md  LEEME.md  README.md
├── docs/
├── seed/menu-demo.json
├── vercel.json                     # reescritura SPA (excepto /api) y caché del service worker
├── drizzle.config.ts
├── drizzle/                        # migraciones SQL generadas por drizzle-kit
├── api/[[...ruta]].ts              # adaptador: expone servidor/app.ts como Vercel Function
├── servidor/                       # API (Node); puede importar de src/dominio/
│   ├── app.ts                      # app Hono con todas las rutas
│   ├── auth.ts                     # JWT, middleware, bcrypt
│   ├── rutas/ acceso.ts  sync.ts  reportes.ts  salud.ts
│   └── db/ esquema.ts  cliente.ts  migrar.ts
├── scripts/
│   ├── dev-api.ts                  # API local con @hono/node-server + PGlite en ./.pglite
│   ├── seed.ts                     # datos demo en la base local (idempotente)
│   └── crear-cuenta.ts             # crea una cuenta en la base indicada por DATABASE_URL (lo usa Bruno)
├── e2e/                            # Playwright
├── public/                         # íconos PWA, favicon
└── src/
    ├── main.tsx  App.tsx  rutas.tsx
    ├── estilos/global.css          # Tailwind + tokens de diseño
    ├── dominio/                    # lógica pura + pruebas (sin React, sin Dexie, sin red)
    │   ├── dinero.ts  fechas.ts  tipos.ts  esquemas.ts
    │   ├── modificadores.ts  carrito.ts  cobro.ts  caja.ts
    │   ├── devoluciones.ts  folios.ts  permisos.ts  pin.ts
    │   └── reportes.ts  csv.ts  reglasServidor.ts
    ├── datos/                      # único lugar que toca Dexie y la red
    │   ├── bd.ts                   # esquema Dexie
    │   ├── api.ts                  # cliente HTTP con token
    │   ├── escrituras.ts           # escribir registro + outbox en una transacción
    │   ├── sync.ts                 # motor push/pull
    │   ├── estadoSync.ts  erroresSync.ts
    │   └── consultas.ts            # hooks con useLiveQuery
    ├── estado/                     # Zustand: sesion.ts  carrito.ts  dispositivo.ts
    ├── impresion/
    │   ├── ticket.ts  html.tsx  escpos.ts
    │   └── drivers/ navegador.ts  usb.ts  bluetooth.ts  index.ts
    ├── componentes/                # UI base propia
    └── pantallas/
        ├── acceso/  inicio/  venta/  cobro/  ventas/
        ├── menu/  caja/  reportes/  usuarios/  configuracion/
```

### Rutas de la app

| Ruta | Pantalla |
|---|---|
| `/acceso` | Inicio de sesión de la cuenta |
| `/dispositivo` | Configuración del dispositivo (primera vez) |
| `/bienvenida` | Asistente inicial (sin configuración de negocio) |
| `/bloqueo` | PIN |
| `/inicio` | Inicio |
| `/venta` | Nueva venta (el cobro es una capa dentro de esta ruta) |
| `/ventas`, `/ventas/:id`, `/ventas/devoluciones` | Historial, detalle, devoluciones |
| `/menu/productos`, `/menu/productos/:id`, `/menu/categorias`, `/menu/modificadores` | Menú |
| `/caja`, `/caja/movimientos`, `/caja/cerrar`, `/caja/cortes`, `/caja/cortes/:id` | Caja |
| `/reportes` | Reportes (pestañas internas) |
| `/usuarios`, `/usuarios/roles` | Usuarios y permisos |
| `/configuracion/negocio`, `/impuestos`, `/pagos`, `/ticket`, `/dispositivo` | Configuración |

Guardas, en este orden: sin token → `/acceso`; dispositivo sin configurar → `/dispositivo`; sin configuración de negocio (ni local ni en el servidor) → `/bienvenida`; sin usuario activo → `/bloqueo`; sin permiso → pantalla "No tienes acceso" con opción de cambiar de usuario.

### Rutas de la API (todas bajo `/api`)

| Método y ruta | Qué hace |
|---|---|
| `GET /api/salud` | Responde `{ ok: true }` (lo usa el indicador de conexión) |
| `POST /api/acceso` | `{ correo, contrasena }` → `{ token, cuenta }`. Sin token. |
| `POST /api/sync/push` | Recibe un lote de operaciones de la outbox y responde el resultado de cada una |
| `GET /api/sync/pull?desde=<rev>` | Devuelve lo que cambió en el servidor desde esa revisión |
| `GET /api/reportes?desde=&hasta=` | Datos de un rango para Reportes (cuando el rango rebasa lo que hay en la tablet) |

Todas menos `salud` y `acceso` exigen `Authorization: Bearer <token>`.

## 4. Entornos

| | Base de datos | API | App |
|---|---|---|---|
| Desarrollo y pruebas (lo que usa Claude Code) | PGlite en `./.pglite` (e2e: carpeta temporal nueva por corrida; unitarias: en memoria) | `scripts/dev-api.ts` en el puerto 8787 | Vite en 5173 con proxy de `/api` → 8787 |
| Producción | Neon (`DATABASE_URL`) | Vercel Functions (`api/`) | Vercel (`dist/`) |

- `servidor/db/cliente.ts` elige el driver: si hay `DATABASE_URL`, `drizzle-orm/neon-http` con `@neondatabase/serverless`; si no, `drizzle-orm/pglite`. El resto del código no sabe cuál es.
- Variables del servidor: `DATABASE_URL` (solo producción), `JWT_SECRET` (en desarrollo, un valor fijo de `.env.development`).
- Variables de la app: `VITE_API_URL` (por defecto `/api`).
- `.env.example` con todas las claves vacías; `.env.development` commiteado con valores de desarrollo; `.env*.local` nunca se commitea.
- **Claude Code nunca usa `DATABASE_URL` ni se conecta a Neon.**

## 5. Modelo de datos

Mismas entidades en Postgres (Drizzle, `servidor/db/esquema.ts`) y en la tablet (Dexie, `src/datos/bd.ts`). En Postgres: columnas en snake_case, `id uuid` generado en el dispositivo (`crypto.randomUUID()`), dinero en `integer` (centavos), fechas en `timestamptz`, `dia` como `date`, arreglos y objetos anidados en `jsonb`. Tipos compartidos en `src/dominio/tipos.ts` (camelCase); la API traduce.

Cada tabla sincronizable tiene además:

- `actualizado_en timestamptz`: hora del dispositivo que hizo el último cambio (para "gana el último" en catálogo y configuración).
- `rev bigint not null`: revisión asignada por el servidor en cada inserción o actualización (`nextval('rev_global')`, una secuencia compartida por todas las tablas). Es el cursor del pull.

| Tabla | Contenido |
|---|---|
| `cuentas` | Cuentas que pueden iniciar sesión: `correo`, `hash_contrasena` (bcrypt), `activa`. **No se sincroniza.** |
| `config` | Una fila (`id = 'general'`) con `datos jsonb`: negocio, impuestos, descuentos, pagos, ticket, categorías de gasto, roles |
| `categorias` | Categorías del menú |
| `grupos_modificadores` | Grupos con sus opciones (`opciones jsonb`) |
| `productos` | Productos (`grupos_ids jsonb`, `imagen text` con data URL) |
| `usuarios` | Usuarios con PIN (hash) |
| `dispositivos` | Dispositivos y espejo del contador de folios |
| `turnos` | Turnos de caja (abiertos y cerrados, con `resumen jsonb`) |
| `movimientos` | Entradas, retiros y gastos |
| `ventas` | Ventas (inmutables salvo estado); `lineas`, `pagos`, `descuento`, `iva`, `cancelacion` en `jsonb`; índice único en `folio` |
| `devoluciones` | Devoluciones |

Índices: `ventas(fecha)`, `ventas(turno_id)`, `movimientos(turno_id)`, `devoluciones(fecha)`, `turnos(dispositivo_id, estado)` y `rev` en cada tabla.

```ts
type Centavos = number;                       // entero
type Permiso = 'vender' | 'aplicarDescuentos' | 'cancelarVentas' | 'modificarPrecios'
  | 'crearProductos' | 'abrirCaja' | 'cerrarCaja' | 'verReportes' | 'registrarGastos';
type Rol = 'admin' | 'encargado' | 'cajero';
type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';
type Fecha = string;                          // ISO 8601 con zona, p. ej. '2026-09-19T14:42:10.123Z'
interface RefUsuario { id: string; nombre: string }

interface ConfigGeneral {
  negocio: { nombre: string; logo: string | null; direccion: string; telefono: string; rfc: string };
  ventas: { preciosIncluyenIVA: boolean; tasaIVA: number; mostrarDesgloseIVA: boolean;
            descuentosPermitidos: boolean; descuentoMaximoPorcentaje: number };
  pagos: { tarjeta: boolean; transferencia: boolean; referenciaTransferenciaObligatoria: boolean;
           cuentas: { id: string; banco: string; titular: string; clabe: string; cuenta: string; alias: string }[] };
  ticket: { ancho: 58 | 80; mostrarLogo: boolean; mostrarDireccion: boolean; mostrarTelefono: boolean;
            mostrarRFC: boolean; mostrarCajero: boolean; mensajeFinal: string; imprimirAlCobrar: boolean };
  gastos: { categorias: string[] };
  roles: Record<'encargado' | 'cajero', Record<Permiso, boolean>>;
  zonaHoraria: string;                        // 'America/Mexico_City'
}

interface Categoria { id: string; nombre: string; color: string; orden: number; activa: boolean }

interface GrupoModificadores {
  id: string; nombre: string; tipo: 'unico' | 'multiple'; obligatorio: boolean;
  min: number; max: number; orden: number;
  opciones: { id: string; nombre: string; precioExtra: Centavos; porDefecto: boolean; disponible: boolean }[];
}

interface Producto {
  id: string; nombre: string; descripcion: string; categoriaId: string; precio: Centavos;
  imagen: string | null;                      // data URL WebP 256×256
  disponible: boolean; orden: number; gruposIds: string[];
}

interface Usuario { id: string; nombre: string; rol: Rol; pinHash: string; pinSal: string; activo: boolean }

interface Dispositivo { id: string; nombre: string; tipo: 'caja' | 'consulta'; prefijo: string | null; ultimoFolio: number }

interface Turno {
  id: string; dispositivoId: string; dispositivoNombre: string; estado: 'abierto' | 'cerrado';
  abiertoPor: RefUsuario; abiertoEn: Fecha; dia: string; fondoInicial: Centavos;
  cerradoPor?: RefUsuario; cerradoEn?: Fecha; efectivoContado?: Centavos;
  conteo?: Record<string, number>;            // denominación → piezas
  resumen?: ResumenTurno; nota?: string;
}

interface Movimiento {
  id: string; turnoId: string; dispositivoId: string; tipo: 'entrada' | 'retiro' | 'gasto';
  categoria: string | null; concepto: string; monto: Centavos; usuario: RefUsuario;
  fecha: Fecha; dia: string; anulado: boolean; anuladoPor?: RefUsuario; anuladoEn?: Fecha;
}

interface LineaVenta {
  id: string; productoId: string; nombre: string; categoriaId: string; categoriaNombre: string;
  precioBase: Centavos; modificadores: { grupo: string; opcion: string; precioExtra: Centavos }[];
  precioUnitario: Centavos; cantidad: number; nota: string | null; importe: Centavos;
}

interface Venta {
  id: string; folio: string; folioNumero: number; dispositivoId: string; dispositivoNombre: string;
  turnoId: string; fecha: Fecha; dia: string; cajero: RefUsuario; cliente: string | null;
  lineas: LineaVenta[]; subtotal: Centavos;
  descuento: { tipo: 'porcentaje' | 'monto'; valor: number; importe: Centavos;
               motivo: string | null; autorizadoPor: RefUsuario | null } | null;
  iva: { tasa: number; incluido: boolean; base: Centavos; monto: Centavos };
  total: Centavos;
  pagos: { metodo: MetodoPago; monto: Centavos; recibido?: Centavos; referencia?: string; cuentaId?: string }[];
  cambio: Centavos;
  estado: 'pagada' | 'cancelada' | 'devuelta_parcial' | 'devuelta'; devuelto: Centavos;
  cancelacion: { motivo: string; usuario: RefUsuario; autorizadoPor: RefUsuario | null; fecha: Fecha } | null;
}

interface Devolucion {
  id: string; ventaId: string; folioVenta: string; turnoId: string | null; dispositivoId: string;
  lineas: { lineaId: string; cantidad: number; importe: Centavos }[]; monto: Centavos;
  metodo: MetodoPago; motivo: string; usuario: RefUsuario; autorizadoPor: RefUsuario | null;
  fecha: Fecha; dia: string;
}
```

`ResumenTurno` lo defines en `src/dominio/caja.ts`: totales por método, ventas, cancelaciones, devoluciones, entradas, retiros, gastos (total y por categoría), efectivo esperado, contado, diferencia, y ventas por producto, categoría y cajero. Se calcula con funciones puras y se guarda al cerrar.

Todo se valida con esquemas Zod (`src/dominio/esquemas.ts`), que usan igual la app y la API.

## 6. Estrategia offline y sincronización

### Local primero

- **Dexie** guarda en IndexedDB todas las tablas sincronizables más `outbox` (cola de salida), `meta` (cursor de pull, token, datos del dispositivo) y `erroresSync`.
- **Toda escritura** pasa por `src/datos/escrituras.ts`: en **una sola transacción de Dexie** guarda el registro y agrega su operación a la outbox. La UI se actualiza al instante y nada depende de la red.
- **Toda lectura** de pantalla usa `useLiveQuery` (dexie-react-hooks) sobre Dexie. Nunca se espera a la red para mostrar algo, salvo Reportes de rangos que no están en la tablet (ver §6.5).
- Al arrancar, pide `navigator.storage.persist()` y guarda el resultado para mostrarlo en Configuración › Dispositivo.

### Operaciones de la outbox

`{ id, tabla, tipo: 'crear' | 'actualizar', registroId, datos, creadaEn, intentos, ultimoError }`. El `id` de la operación es un UUID: el servidor lo usa para que reenviar la misma operación no tenga efecto doble.

### Push (subir)

- Se dispara 1 segundo después de cada escritura, cada 15 segundos con conexión y con el evento `online`.
- Envía las operaciones en orden de creación, en lotes de hasta 100, a `POST /api/sync/push`. Solo un push a la vez.
- El servidor responde por operación: `aplicada`, `duplicada` (ya se había aplicado; cuenta como éxito) o `rechazada` con motivo. Las aplicadas y duplicadas salen de la outbox. Las rechazadas pasan a `erroresSync` y salen de la outbox (no se reintentan solas para no bloquear la cola).
- Error de red o 5xx: se deja todo en la outbox y se reintenta con espera creciente (5 s, 15 s, 30 s, 60 s máximo).
- 401: el token ya no sirve; se muestra "La sesión de este dispositivo expiró. Vuelve a iniciar sesión." **sin borrar la outbox**, y al volver a entrar se sigue subiendo.

### Reglas del servidor al aplicar operaciones

Viven en `src/dominio/reglasServidor.ts` (funciones puras, con pruebas) y las usa `servidor/rutas/sync.ts`:

- **ventas, movimientos, devoluciones, turnos:** `crear` = `INSERT ... ON CONFLICT (id) DO NOTHING`. Nunca se borran.
- **ventas `actualizar`:** solo `estado`, `cancelacion`, `devuelto`. Cualquier otro campo se rechaza.
- **movimientos `actualizar`:** solo `anulado`, `anulado_por`, `anulado_en`.
- **turnos `actualizar`:** solo si en el servidor sigue `abierto`.
- **config, categorías, grupos, productos, usuarios, dispositivos:** `crear`/`actualizar` como upsert; gana el `actualizado_en` más reciente (si el servidor tiene uno más nuevo, responde `duplicada` y el pull traerá la versión ganadora). Se permite borrar categorías y productos (`tipo: 'borrar'`), porque las ventas guardan copia.
- Validación con Zod. **Poco estricta a propósito en `crear` de ventas**: rechazar una venta al sincronizar es peor que aceptar un dato raro.
- Cada inserción o actualización asigna `rev = nextval('rev_global')`.
- Sin transacciones interactivas (el driver HTTP de Neon no las soporta): cada operación es una sentencia idempotente. Si hace falta agrupar, `db.batch()`.

### Pull (bajar)

- Cada 15 segundos con conexión, al volver `online`, al enfocar la ventana y justo después de un push.
- `GET /api/sync/pull?desde=<rev>` devuelve las filas con `rev` mayor, de todas las tablas, ordenadas por `rev`, máximo 500 por página, más el `rev` más alto enviado. Se pide la siguiente página hasta vaciar.
- Alcance: catálogo, configuración, usuarios y dispositivos completos; ventas, movimientos, devoluciones y turnos **solo de los últimos 35 días** (el primer pull de un dispositivo nuevo también se limita a ese rango).
- Se aplica en Dexie con `bulkPut`, **excepto** registros que tengan operaciones pendientes en la outbox (lo local gana hasta que se sube).
- Una vez al día, borra de Dexie ventas, movimientos, devoluciones y turnos cerrados con más de 35 días que no estén en la outbox.

### Reportes de rangos grandes

Si el rango pedido cabe en los 35 días locales, Reportes calcula con los datos de Dexie (sirve sin conexión). Si no, con conexión llama `GET /api/reportes`, que devuelve las filas del rango y la app calcula con **las mismas funciones puras** de `src/dominio/reportes.ts`. Sin conexión y fuera de rango: "Sin conexión: solo están disponibles los últimos 35 días."

### Indicador de sincronización

`estadoSync` combina `navigator.onLine`, el resultado del último push/pull y `GET /api/salud`. Muestra "En línea" o "Sin conexión: N ventas por subir" (N = operaciones de ventas en la outbox). Las ventas con operación pendiente llevan la insignia "Por subir" en el historial.

## 7. Cuenta, dispositivo y PIN

- **Cuenta:** `POST /api/acceso` verifica el correo y la contraseña (bcrypt) contra `cuentas` y regresa un JWT (`jose`, HS256, `JWT_SECRET`, vigencia de 1 año) con el `id` de la cuenta. La tablet guarda el token en Dexie (`meta`). El middleware revisa firma, vigencia y que la cuenta siga `activa` (desactivarla corta el acceso de sus dispositivos). Tras 5 intentos fallidos desde la misma IP, esperar 1 minuto.
- Las cuentas **no se crean desde la app**: en desarrollo las crea el seed; en producción, Bruno con `npm run crear-cuenta -- correo contraseña`.
- **Dispositivo:** `id` generado una vez, guardado en Dexie junto con nombre, tipo, prefijo, contador de folios y configuración de impresora. Se sincroniza como cualquier otra tabla.
- **PIN:** `hash = SHA-256(sal + ':' + pin)` en hexadecimal, con `sal` aleatoria de 16 bytes por usuario (Web Crypto). Se valida localmente contra cada usuario activo, sin red. Al guardar, verifica que el PIN no coincida con el de otro usuario.
- **Sesión** (Zustand, en memoria): usuario activo, última actividad, temporizador de bloqueo. Recargar pide PIN de nuevo.
- Los permisos por rol (Cajero/Encargado) se aplican en la app, no en la API: el token es del dispositivo, no de la persona. Es aceptable para este POS provisional y queda documentado en el README.

## 8. Permisos

`src/dominio/permisos.ts`: roles por defecto (tabla de `01-especificacion.md` §3), `puede(usuario, permiso, roles)` (admin siempre `true`). En la UI: `<RequierePermiso permiso="...">` y `pedirAutorizacion(permiso): Promise<RefUsuario | null>` (modal con teclado de PIN; devuelve quién autorizó).

## 9. Folios

- Contador local del dispositivo (en Dexie) = fuente de verdad. Siguiente folio: `ultimoFolio + 1`, en la **misma transacción de Dexie** que guarda la venta. Formato: `${prefijo}-${n.toString().padStart(6, '0')}`.
- El registro del dispositivo se actualiza con el nuevo `ultimoFolio` y se sincroniza.
- Al configurar un dispositivo (con conexión), el contador arranca en el mayor entre el valor del servidor y el `folio_numero` más alto de las ventas con ese prefijo.
- El índice único de `folio` en Postgres detecta prefijos duplicados: si llega un folio repetido de otro dispositivo, la operación se rechaza y aparece en `erroresSync`.

## 10. Impresión

### Capas

1. **`TicketDocumento`** (datos puros): `{ columnas: 32 | 48, lineas: LineaTicket[] }`, donde cada línea es texto (alineación, negrita, tamaño doble), columnas izquierda/derecha, separador, logo, QR, espacio o corte.
2. **Constructores puros:** `construirTicketVenta(venta, config, opciones)` y `construirTicketCorte(turno, config)`. Pruebas con snapshot.
3. **Renderizadores:** `html.tsx` (vista previa en pantalla e impresión por navegador con `@page { size: 58mm auto }` o `80mm`) y `escpos.ts` (bytes ESC/POS con `ReceiptPrinterEncoder`: acentos y ñ con la página de códigos adecuada, probando con "Café, Piña, Año, ¡Gracias!"; logo en blanco y negro con ancho múltiplo de 8; QR nativo de la impresora).
4. **Drivers** con la misma interfaz `{ soportado(), conectar(), reconectar(), imprimir(doc), estado }`:
   - `navegador`: `window.print()` sobre un iframe oculto con el HTML del ticket. Funciona en todos lados (en iPad, por AirPrint o PDF).
   - `usb`: `WebUSBReceiptPrinter`. Solo Chrome en Android o escritorio (en Windows el driver del sistema puede acaparar la impresora).
   - `bluetooth`: `WebBluetoothReceiptPrinter`. Solo Chrome en Android o escritorio, y solo impresoras Bluetooth Low Energy (muchas impresoras baratas son Bluetooth clásico y no aparecen).
5. Detección: `'usb' in navigator`, `'bluetooth' in navigator`. Solo se ofrecen las opciones que el dispositivo soporta, con una nota cuando no hay ninguna directa ("En este dispositivo se imprime con el diálogo del sistema").

`conectar()` debe llamarse desde un toque del usuario (restricción del navegador). Los datos para reconectar se guardan en la configuración local del dispositivo. WebUSB, Web Bluetooth y el service worker exigen HTTPS (o localhost).

| Dispositivo | Navegador | USB directo | Bluetooth directo |
|---|:-:|:-:|:-:|
| iPad / iPhone (Safari o Chrome) | ✓ | – | – |
| Android con Chrome | ✓ | ✓ | solo BLE |
| Computadora con Chrome | ✓ | ✓ (no siempre en Windows) | solo BLE |

Los drivers USB y Bluetooth no se pueden probar sin la impresora: impleméntalos, prueba los bytes con pruebas unitarias y anota en la bitácora "Probar con impresora real".

## 11. Seguridad de la API

- El navegador nunca recibe `DATABASE_URL`. Todo acceso a datos pasa por la API.
- Todas las rutas salvo `salud` y `acceso` exigen token válido de una cuenta activa.
- Nada se borra en ventas, movimientos, devoluciones ni turnos; las ventas solo cambian estado, cancelación y devuelto (§6, "Reglas del servidor").
- Consultas siempre con Drizzle (parámetros), nunca SQL armado con texto del cliente.
- Límite de tamaño del cuerpo en `push` (por ejemplo 2 MB) y de operaciones por lote (100).
- Pruebas de la API (Vitest + PGlite en memoria + `app.request()` de Hono): sin token → 401; token de cuenta desactivada → 401; `crear` venta dos veces → una sola fila; actualizar un campo prohibido de una venta → rechazada; borrar una venta → rechazada; turno cerrado no se modifica; pull devuelve solo lo posterior al cursor.

## 12. PWA y Vercel

- `vite-plugin-pwa` con `registerType: 'prompt'`, `navigateFallback: 'index.html'` con `navigateFallbackDenylist: [/^\/api\//]`, precache de js, css, html, íconos y fuentes. **Nunca** cachear `/api`.
- Manifest: nombre "POS Cafetería", `display: 'standalone'`, colores de `03-interfaz.md`, íconos 192/512 y maskable (genéralos desde un SVG propio: una taza simple, sin marcas).
- Actualización: aviso "Hay una versión nueva." con botón "Actualizar", solo cuando el carrito está vacío. **Nunca** recargar solo.
- iPad: se instala desde Safari › Compartir › "Agregar a inicio". La app instalada tiene su propio almacenamiento, separado de la pestaña de Safari (hay que iniciar sesión dentro de la app instalada).
- `vercel.json`: reescritura de todo lo que **no** empiece con `/api/` hacia `/index.html`; `Cache-Control: public, max-age=0, must-revalidate` para `/sw.js`, `/registerSW.js` y `/manifest.webmanifest`; `public, max-age=31536000, immutable` para `/assets/*`.
- `api/[[...ruta]].ts` exporta la app de Hono con el adaptador que indique la documentación actual de Hono para Vercel (runtime Node). No se puede probar de noche: anótalo en "Para probar a mano".

## 13. Pruebas

- **Unitarias (Vitest)** en `src/dominio/`: dinero, fechas (incluye cruce de medianoche UTC), modificadores, carrito, cobro, caja, devoluciones, folios, permisos, PIN, reportes, CSV, reglas del servidor y constructores de ticket (snapshot). Los casos A–J de `01-especificacion.md` §6 son obligatorios.
- **Datos locales:** `src/datos/` con `fake-indexeddb`: escritura + outbox en una transacción, motor de sync contra un servidor simulado (red caída, 5xx, 401, rechazo, duplicado, orden de operaciones, pull que no pisa cambios pendientes).
- **API:** Vitest con PGlite en memoria y migraciones aplicadas (casos de §11).
- **E2E (Playwright, Chromium, viewport 1280×800):** `webServer` levanta la API local con una base PGlite nueva (seed incluido) y Vite. Flujos mínimos: acceso con PIN y cambio de usuario; cajero sin acceso a Reportes; abrir caja; venta con modificadores y descuento; presupuesto de toques (`01-especificacion.md` §7); efectivo con cambio; pago combinado; cancelar; devolución; corte con faltante; crear producto y venderlo; autorización con PIN; **offline** (`context.setOffline(true)` → vender → volver en línea → verificar que la venta llegó a la base); **dos dispositivos** (dos contextos del navegador: lo que vende uno aparece en el otro tras el pull); **PWA** (build + preview → cargar → sin red → recargar → la app abre y deja vender).
- Datos demo (seed): cuenta `caja@demo.test` / `demo1234`; usuarios Dueño (PIN 1234, admin), Encargada (2222, encargado) y Cajero (1111, cajero); menú y configuración de `seed/menu-demo.json`.

## 14. Qué no se prueba en la noche

Impresión física (USB/Bluetooth), instalación en iPad/Android real, Neon real y el despliegue en Vercel (incluido el adaptador de `api/`). Todo eso queda en "Para probar a mano" de la bitácora.

## 15. Producción (lo hace Bruno, no Claude Code)

1. En Neon, crear un proyecto o una rama nueva para el POS y copiar su `DATABASE_URL`.
2. Aplicar migraciones: `DATABASE_URL=... npm run db:migrar`.
3. Crear las cuentas de cada tablet y la del dueño: `DATABASE_URL=... npm run crear-cuenta -- caja1@tucafe.mx contraseña-segura`.
4. En Vercel, importar el repositorio (detecta Vite; salida `dist`). En Settings › Environment Variables agregar `DATABASE_URL` y `JWT_SECRET` (una cadena larga y aleatoria, por ejemplo `openssl rand -base64 48`). También se puede conectar Neon con la integración de Vercel para que ponga `DATABASE_URL` sola.
5. Desplegar y abrir `https://tu-pos.vercel.app/api/salud`: debe responder `{ "ok": true }`.
6. En la tablet, abrir la URL (HTTPS). Android: Chrome › Instalar app. iPad: Safari › Compartir › Agregar a inicio. Iniciar sesión dentro de la app instalada, configurar el dispositivo y seguir el asistente inicial.
7. Configuración › Impresora › "Imprimir prueba".

Cada `git push` a la rama principal redepliega app y API. Si cambia el esquema: `npm run db:generar` en desarrollo, commit de la migración y `npm run db:migrar` contra Neon antes o junto con el despliegue.
