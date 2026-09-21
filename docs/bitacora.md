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
2.2 | hecho | Pantalla de acceso con errores claros (credenciales, primer inicio sin internet, sesión expirada con correo precargado); datos/sesion.ts guarda el token en Dexie y dispara el sync; e2e de acceso y de recarga sin API.
2.3 | hecho | FormularioDispositivo (nombre, tipo caja/consulta, letra A–Z con aviso si otra caja la usa), configurarDispositivo() guarda en Dexie + outbox y arranca el contador con el mayor entre dispositivos con ese prefijo y ventas locales; componente Segmentos; pruebas y e2e.
2.4 | hecho | Asistente /bienvenida (negocio, Administrador con PIN confirmado, menú de ejemplo opcional sin usuarios demo); inicializarNegocio() en una transacción; componente Interruptor; e2e con servidor vacío simulado (pull vacío, push bloqueado).
2.5 | hecho | TecladoPin propio (teclas de 72 px, prueba al llegar a 4–6 dígitos, tecla Entrar, espera de 30 s tras 5 fallos, teclado físico), pantalla /bloqueo, bloqueo por inactividad (meta bloqueoMinutos, 0 = nunca); e2e: PIN, recarga pide PIN, espera tras 5 fallos.
2.6 | hecho | autorizarConPin() en dominio/permisos (probado con cajero y encargada), pedirAutorizacion(permiso) con store y DialogoAutorizacion (TecladoPin; mensaje si el PIN es de alguien sin permiso), useAutorizar() que regresa usuario y autorizadoPor, y <RequierePermiso>. La prueba de UI con cajero va en el e2e de 3.5.
2.7 | hecho | IndicadorConexion (En línea / Sin conexión: N ventas por subir), AvisosSync (franja sin conexión y, para el Administrador, cada escritura rechazada con su folio, motivo y Reintentar); e2e con context.setOffline.
2.8 | hecho | e2e: acceso + PIN + cambiar usuario + bloquear; el cajero no ve Reportes, Configuración ni Usuarios y en /reportes ve 'No tienes acceso'; el guardián regresa a la ruta pedida después del PIN; ayudas e2e compartidas.
3.1 | hecho | abrirTurno() (un turno abierto por dispositivo, en transacción), FormularioAbrirCaja con CampoDinero y autorización, Caja actual cerrada/abierta, Nueva venta bloqueada sin caja con 'Abrir caja'; e2e verifica el turno en la base; ayudas leerServidor/esperarSubida.
3.2 | hecho | Catalogo: pestañas de categorías activas en orden, cuadrícula auto-fill 140 px con botones de 104 px (franja de color, precio, imagen opcional), no disponibles apagados, buscador sin acentos en todas las categorías (dominio/texto.ts); store del carrito (estado/carrito.ts) guardado en Dexie en cada cambio.
3.3 | hecho | HojaPersonalizacion: grupos en el orden del producto con indicación (elige 1 / opcional / hasta 2), opciones de 56 px, por defecto elegidas, tope al máximo, nota, cantidad y 'Agregar $130.00' (o 'Elige tamaño' deshabilitado); caso J verificado en captura.
3.4 | hecho | PanelVenta: 'Para:', líneas (cantidad, resumen, nota, precio unitario si >1) con − / + / Editar (reabre la hoja) / Nota / Eliminar, línea recién agregada resaltada, totales, Vaciar con confirmación ('Se quitarán N productos'), barra Cobrar de 72 px; en vertical barra 'Ver venta (N)' + 'Cobrar'; carrito sobrevive a recargar (captura).
3.5 | hecho | DialogoDescuento (porcentaje con atajos o monto, motivo, tope de configuración, Quitar descuento); se autoriza al aplicar y guarda autorizadoPor; solo si descuentosPermitidos; e2e con cajero (pide PIN, rechaza PIN sin permiso) y encargada (directo).
3.6 | hecho | Panel muestra subtotal, descuento, IVA (incluido o 'IVA 16 %' sumado al total según configuración) y total en Cobrar con calcularTotales; e2e: caso B da $193.50 e IVA incluido $26.69 (caso C cubierto en pruebas unitarias).
3.7 | hecho | e2e: abrir caja, caso A con modificadores, 'Para:', nota, descuento 10 %, recargar (espera a que IndexedDB confirme) y el carrito sigue igual; editar línea; vaciar con confirmación; buscador sin acentos.
4.1 | hecho | CapaCobro a pantalla completa: total, métodos activos según configuración, pagos con Quitar, pendiente; 'Volver a la venta' descarta pagos y conserva el carrito.
4.2 | hecho | PanelEfectivo: Exacto, hasta 3 billetes mayores al pendiente, TecladoNumerico (pesos enteros, 00, ⌫), cambio a 48 px; 'Confirmar cobro' o 'Agregar pago'.
4.3 | hecho | PanelTarjeta (monto = pendiente, referencia opcional, 'Pagado con tarjeta') y PanelTransferencia (cuentas, CLABE en grupos de 4, referencia obligatoria según config, 'Marcar como pagada').
4.4 | hecho | Pagos combinados con agregarPago (uno por método, solo efectivo excede) y cambio automático a otro método; total en cero muestra 'Nada que cobrar' + 'Confirmar' sin pagos.
4.5 | hecho | armarVenta() pura (copia completa del carrito, descuento con importe, IVA, pagos, cambio) + registrarVenta() con folio en la misma transacción; resultado en el carrito vacío (folio y cambio a 64 px).
4.6 | hecho | e2e: presupuesto de toques (Americano exacto 5, Latte mediano almendra $100 7 con cambio $15, Brownie tarjeta 4), casos E y F, Volver a la venta, y las ventas llegan a la base con folios H-000001..3 y J-000001..2.
5.1 | hecho | impresion/ticket.ts: TicketDocumento (texto, columnas, separador, logo, QR, espacio, corte), construirTicketVenta (32/48 col., reimpresión, cancelada, IVA incluido/no, pagos con referencia, devuelto) y construirTicketCorte; ticketATexto con ajuste de renglones; snapshots (el de 58 mm coincide con el ejemplo de la especificación).
5.2 | hecho | impresion/html.tsx (ticketAHTML con los mismos renglones que el texto, documento con @page de 58/80 mm, VistaTicket para pantalla), driver navegador (iframe oculto + window.print), useImpresora con error y Reintentar; 'Imprimir ticket' en el resultado de la venta; PDF de prueba revisado: igual al ejemplo de §5.4.
5.3 | hecho | impresion/escpos.ts con ReceiptPrinterEncoder (CP437 automática, negrita, doble, QR nativo, corte parcial, logo dithering atkinson múltiplo de 8 vía prepararLogo); pruebas de bytes con 'Café, Piña, Año, ¡Gracias!'.
5.4 | hecho | Drivers con interfaz común { soportado, conectar, reconectar, imprimir, estado }: navegador, USB (WebUSB) y Bluetooth (BLE) vía crearDriverDirecto (carga perezosa de la librería, espera el evento connected, codifica en el idioma/codepage que reporta la impresora, logo en canvas); driversDisponibles() solo ofrece lo soportado; tipos .d.ts propios; prueba con impresora simulada. Probar con impresora real.
5.5 | hecho | Configuración › Dispositivo › Impresora (solo conexiones soportadas, Conectar/Cambiar, estado, 'Imprimir prueba' con acentos), guardada en meta local; useImpresora elige el driver, reconecta con los datos guardados y muestra el error con Reintentar; impresión automática al cobrar si imprimirAlCobrar; e2e con el driver de navegador (ticket y prueba).
5.6 | hecho | BotonCompartir: Web Share con el texto del ticket; sin Web Share, hoja con 'Copiar texto' y 'Abrir WhatsApp' (wa.me con el texto); en el resultado de la venta (en el detalle se agrega en 8.2); e2e de ambos caminos.
6.1 | hecho | Caja actual en vivo con resumirTurno (fondo, ventas por método, entradas, retiros, gastos, devoluciones, cancelaciones); efectivo esperado solo con verReportes; aviso si viene de otro día; botones de movimientos y Cerrar caja; TablaCifras reutilizable; escrituras registrarMovimiento, anularMovimiento y cerrarTurno con pruebas.
6.2 | hecho | Movimientos del turno: registrar entrada/retiro/gasto (categorías de configuración, permiso registrarGastos o autorización), lista con hora, tipo, concepto, usuario y monto; Anular con confirmación (queda tachado con 'Anulado por'); componente Insignia; e2e: 500+200−300−80 = 320 y al anular el retiro 620.
6.3 | hecho | Cerrar caja en pasos: contar por denominaciones (tabla con piezas, subtotal y teclado) o total directo sin ver el esperado (corte ciego); resultado con esperado, contado y diferencia grande (Faltan/Sobran/Cuadra exacto), resumen, nota y aviso de ventas por subir; cerrarTurno guarda estado, conteo y resumen; requiere cerrarCaja o autorización.
6.4 | hecho | CorteCerrado: 'Caja cerrada. Diferencia: faltan $X.' con 'Imprimir corte' (useImpresora + construirTicketCorte) y vista previa del ticket de corte.
6.5 | hecho | Cortes de caja: tabla de turnos cerrados (cierre, dispositivo, abrió/cerró, total, diferencia en color) y detalle con totales, esperado/contado/diferencia, nota, vista del ticket con marca de reimpresión y 'Reimprimir'.
6.6 | hecho | e2e: cajero abre con $500, vende $45, gasta $80, cuenta $450 por denominaciones sin ver el esperado; resultado 'Faltan $15.00'; corte en historial y detalle con reimpresión; el turno cerrado llega a la base con resumen.diferencia = −1500.
7.1 | hecho | Categorías: lista con color, número de productos, interruptor activa, subir/bajar (dominio/orden.ts + guardarVarios en una transacción), crear/editar nombre y color (paleta de 8), eliminar solo sin productos ('Mueve o elimina sus productos primero'); requiere crearProductos.
7.2 | hecho | Modificadores: lista con indicación y opciones, número de productos que lo usan, orden, crear/editar (tipo una/varias, obligatorio, mín./máx., opciones con precio extra, por defecto único en 'una opción', disponible) validado con Zod; eliminar quita el grupo de los productos (guardarVarios) y deja lápida.
7.3 | hecho | Productos: lista con buscador, filtro por categoría, disponible directo, subir/bajar dentro de su categoría; crear/editar con vista previa del botón, categoría, precio (solo con modificarPrecios o autorización), descripción, imagen recortada 256×256 WebP ≤60 KB (JPEG si el navegador no codifica WebP), disponible y grupos en orden; eliminar con confirmación; estado vacío con 'Cargar menú de ejemplo' (escribirMenu compartido con el asistente).
7.4 | hecho | e2e: crear categoría (color), grupo obligatorio con opción por defecto y precio extra, producto con imagen (queda en WebP) y el grupo; se vende al instante ($60) y la línea llega a la base con su copia; encargada con precio bloqueado hasta autorización.
8.1 | hecho | Historial (datos locales, hoy por defecto): SelectorRango reutilizable (Hoy/Ayer/Semana/Mes/Personalizado con tope), filtros por folio, método, cajero y estado (dominio/historial.ts con pruebas); tabla con folio, hora, productos, total, pago, cajero, insignias de estado y 'Por subir'; estado vacío con 'Nueva venta'.
8.2 | hecho | Detalle de venta: vista del ticket, Reimprimir (con marca de reimpresión), Compartir, insignias de estado y 'Por subir', cancelación y devoluciones registradas.
8.3 | hecho | Cancelar venta: solo pagadas con su turno abierto, motivo obligatorio, cancelarVentas o autorización (guarda autorizadoPor); deja de contar en la caja; ticket con '*** VENTA CANCELADA ***'.
8.4 | hecho | Devolución total o parcial (Todo/Nada y cantidades por línea), reembolso proporcional en vivo (caso I), método de reembolso (efectivo exige caja abierta en este dispositivo), registrarDevolucion en una transacción (devolución + devuelto/estado); lista de Devoluciones por fechas con enlace a la venta.
8.5 | hecho | e2e: el cajero cancela (autoriza la encargada) y devuelve una línea en efectivo; historial y filtros, lista de devoluciones, efectivo esperado 500+75−30 = 545 y los cambios llegan a la base.
9.1 | hecho | Usuarios: lista (nombre, rol, estado), crear/editar con rol, PIN 4–6 único con confirmación (pinEnUso; en edición el PIN es opcional), activo; validarUltimoAdmin en dominio impide desactivar o degradar al último Administrador activo.
9.2 | hecho | Roles y permisos: matriz con Administrador fijo y interruptores para Encargado y Cajero que guardan la config (efecto inmediato vía useLiveQuery); useConfigEditable en estado/config.ts.
9.3 | hecho | e2e: crear usuario (PIN repetido rechazado), último Administrador protegido; quitar 'registrar gastos' al cajero hace que pida autorización (autoriza la encargada) y se restaura el permiso.

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
- Prefijo repetido: se advierte pero se permite (caso de una tablet que reemplaza a otra); el contador continúa desde el mayor folio conocido.
- El teclado de PIN lleva una tecla Entrar (✓) en el hueco de la última fila: sin ella, un PIN de 4 dígitos equivocado no se podría rechazar hasta escribir 6.
- Los cambios de 4.1–4.5 van en un solo commit porque la capa de cobro y sus paneles no funcionan por separado.
- El presupuesto de toques se cuenta con el producto ya a la vista (la especificación no incluye el toque de pestaña de categoría en la secuencia).

## Para probar a mano (Bruno)

- Impresión con la impresora real (USB o Bluetooth, en Android con Chrome).
- Instalación como app en la tablet real (Android: Chrome › Instalar app; iPad: Safari › Compartir › Agregar a inicio).
- Neon real: migraciones y cuentas (`npm run db:migrar`, `npm run crear-cuenta`).
- Despliegue en Vercel: adaptador de `api/`, variables `DATABASE_URL` y `JWT_SECRET`, `/api/salud`.

## Resumen final

(al terminar el plan: qué quedó, qué probar primero, qué falta, cómo correrlo)
