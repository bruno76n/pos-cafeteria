# 01 · Especificación funcional

## 1. Objetivo y alcance

POS provisional para **una sola cafetería**. De una a tres tablets cobran en el mostrador y el dueño puede consultar reportes desde su celular. Prioridades, en este orden:

1. Que una venta nunca se pierda (aunque no haya internet o se cierre la app).
2. Que cobrar sea rapidísimo.
3. Que la caja cuadre.

No es un POS de supermercado: no hay inventario ni alertas de productos agotados. La configuración puede ser completa, pero la pantalla de venta debe ser extremadamente rápida.

### Fuera de alcance en esta versión

Inventario y recetas, alertas de agotados, facturación electrónica (CFDI), mesas o cuentas abiertas, comandas a cocina, varias sucursales, programa de lealtad, integración con terminal bancaria, pedidos en línea.

## 2. Glosario

| Término | Significado |
|---|---|
| Cuenta | Correo y contraseña con los que se inicia sesión **una vez por dispositivo**. Da acceso a los datos del servidor. |
| Usuario | Persona que usa el POS (Administrador, Encargado, Cajero). Se identifica con PIN. |
| Dispositivo | Tablet o celular con la app. Tipo **caja** (vende) o **consulta** (solo ve y administra). |
| Turno (caja) | Periodo entre abrir y cerrar caja en un dispositivo. Toda venta pertenece a un turno. |
| Corte | Cierre de un turno con conteo de efectivo y diferencia. |
| Movimiento | Entrada, retiro o gasto de efectivo dentro de un turno. |
| Tamaño | Variante de un producto con su propio precio ("Chica", "Grande", "12 oz"). Cada producto define los suyos. |
| Ingrediente | Elemento del catálogo (Nutella, Jamón…) con grupo opcional ("Dulces", "Salados"). No tiene precio: el precio del ingrediente extra lo pone cada producto. |
| Producto armado | Producto que se arma con ingredientes (crepas): cada tamaño incluye N ingredientes y los demás se cobran como extra. |
| Grupo de modificadores (extras) | Conjunto de opciones (Leche, Extra shot, Jarabes…) que se asigna a productos en "Opciones adicionales". |
| Folio | Identificador visible de la venta, por dispositivo: `A-000123`. |

## 3. Roles y permisos

| Permiso | Clave | Administrador | Encargado | Cajero |
|---|---|:-:|:-:|:-:|
| Vender | `vender` | ✓ | ✓ | ✓ |
| Aplicar descuentos | `aplicarDescuentos` | ✓ | ✓ | – |
| Cancelar ventas y hacer devoluciones | `cancelarVentas` | ✓ | ✓ | – |
| Modificar precios | `modificarPrecios` | ✓ | – | – |
| Crear y editar productos, categorías, ingredientes y modificadores | `crearProductos` | ✓ | ✓ | – |
| Abrir caja | `abrirCaja` | ✓ | ✓ | ✓ |
| Cerrar caja | `cerrarCaja` | ✓ | ✓ | ✓ |
| Ver reportes | `verReportes` | ✓ | ✓ | – |
| Registrar gastos y movimientos de caja | `registrarGastos` | ✓ | ✓ | ✓ |
| Usuarios y Configuración | (solo Administrador) | ✓ | – | – |

- El Administrador tiene todo y su fila no se edita. Solo él entra a Usuarios y Configuración.
- Los permisos de Encargado y Cajero se editan en Usuarios › Roles y permisos (los de la tabla son los valores por defecto).
- Si el usuario activo no tiene un permiso, la acción muestra **"Pedir autorización"**: otro usuario con ese permiso escribe su PIN, la acción se ejecuta y queda registrada con `autorizadoPor`.

## 4. Acceso

**4.1 Cuenta.** La primera vez que se abre la app en un dispositivo se pide correo y contraseña de la cuenta. Requiere internet solo esa vez; después la sesión persiste aunque no haya conexión. Las cuentas no se crean desde la app. Si no hay internet en el primer inicio: "Necesitas internet para el primer inicio de sesión en este dispositivo."

**4.2 Configuración del dispositivo** (primera vez, después de la cuenta): nombre ("Caja 1"), tipo (caja o consulta) y, si es caja, prefijo de folio (una letra A–Z, único entre dispositivos). Se guarda localmente y en `dispositivos/{id}`.

**4.3 Asistente inicial.** Si no existe la configuración del negocio: nombre del negocio, crear el Administrador (nombre + PIN) y la opción "Cargar menú de ejemplo" (usa `seed/menu-demo.json`, sin sus usuarios demo).

**4.4 Bloqueo con PIN.** Pantalla con teclado numérico propio. Cada PIN es único (4 a 6 dígitos), así que el PIN identifica al usuario. Tras 5 intentos fallidos, espera de 30 segundos. Desde la barra superior: "Cambiar usuario" y "Bloquear". Bloqueo automático por inactividad configurable por dispositivo (por defecto, desactivado). Una recarga de la app vuelve a pedir PIN, pero conserva el carrito.

**4.5 Conexión y sincronización.** Indicador siempre visible en la barra superior: "En línea", o "Sin conexión: 3 ventas por subir". Las ventas pendientes de subir muestran la insignia "Por subir" en el historial. Si una escritura es rechazada al sincronizar, aparece un aviso persistente para el Administrador con el folio y la opción de reintentar.

## 5. Módulos

### 5.1 Inicio

Contenido según permisos:

- **Con `verReportes`:** ventas de hoy (total vendido, número de ventas, ticket promedio), ventas por método (efectivo, tarjeta, transferencia), caja actual (estado, quién abrió, desde cuándo, efectivo esperado), resumen del día (5 productos más vendidos, cancelaciones, devoluciones, gastos).
- **Sin `verReportes`:** estado de la caja del dispositivo, botón grande "Nueva venta" (o "Abrir caja") y número de ventas del turno. Sin montos de efectivo.
- Si la caja lleva abierta desde un día anterior: aviso "La caja está abierta desde ayer. Ciérrala para empezar el día con cuentas claras."

Criterio de aceptación: las cifras coinciden con la suma de las ventas no canceladas de hoy y se actualizan solas al registrar una venta (las de otro dispositivo llegan en unos segundos cuando hay conexión).

### 5.2 Nueva venta

- Requiere un turno abierto en el dispositivo. Si no hay: "Abre la caja para empezar a vender" con botón "Abrir caja" (o pedir autorización).
- **Categorías** como pestañas grandes (solo activas, en su orden). **Productos** en cuadrícula de botones grandes con nombre, precio y franja del color de su categoría. Los no disponibles se ven apagados con la etiqueta "No disponible" y no se pueden tocar.
- **Buscador**: filtra por nombre en todas las categorías, sin distinguir acentos ni mayúsculas.
- Los productos con tamaños muestran "Desde $XX" (el tamaño más barato) en la cuadrícula.
- **Tocar un producto sin tamaños, ingredientes ni extras** agrega una línea (cantidad 1). Si ya existe una línea idéntica (mismo producto, sin opciones, sin nota), suma 1 a esa línea.
- **Tocar un producto con tamaños, ingredientes o extras** abre la hoja de personalización, en este orden: **Tamaño** (viene elegido el primero) → **Ingredientes** → **Extras** (modificadores, con las opciones por defecto ya elegidas) → **Nota** → **Cantidad**, y el botón "Agregar $85.00" con el precio calculado. Si falta algo obligatorio, el botón dice qué falta ("Elige al menos 1 ingrediente") y queda deshabilitado.
- **Ingredientes en la hoja:** botones grandes agrupados por grupo, con el texto "Incluye 2. Cada extra +$5.00" (y "Máximo 5" si hay límite) y el contador "3 elegidos: 1 extra". Al llegar al máximo, los demás se deshabilitan; los no disponibles salen apagados.
- Líneas idénticas (mismo producto, tamaño, ingredientes —en cualquier orden— y extras, sin nota) se fusionan.
- **Carrito:** cada línea muestra cantidad, nombre con tamaño ("Crepa dulce Grande"), debajo los ingredientes y extras ("Nutella, Plátano, Fresa, Nuez (2 extra)"), nota e importe. Acciones por línea: + / −, eliminar, editar (reabre la hoja con lo elegido), nota.
- **"Para:"** campo opcional con el nombre del cliente (para llamarlo cuando esté su bebida). Sale en el ticket.
- **Descuento** a toda la venta, en porcentaje o monto, con motivo opcional. Requiere `aplicarDescuentos` o autorización. Tope: `descuentoMaximoPorcentaje` de la configuración. Solo si `descuentosPermitidos`.
- **Totales:** subtotal, descuento, IVA según configuración (ver §6) y total.
- **Vaciar** con confirmación.
- El carrito se guarda localmente en cada cambio y se recupera tras recargar o cerrar la app.
- Después de cobrar, el carrito vacío muestra el resultado de la última venta (folio, cambio en grande, "Imprimir ticket", "Compartir") hasta que se agrega el siguiente producto. No hay pantalla intermedia que cerrar.

### 5.3 Cobro

Se abre con el botón "Cobrar $193.50" y ocupa la pantalla. Muestra el total, lo pagado y lo pendiente. Métodos disponibles según configuración (efectivo siempre activo).

- **Efectivo** (pestaña por defecto): botón "Exacto" y hasta tres billetes comunes mayores al pendiente (de 20, 50, 100, 200, 500 y 1000), más teclado numérico para otra cantidad. Muestra el cambio en grande. El botón de acción dice **"Confirmar cobro"** si lo recibido cubre el pendiente, o **"Agregar pago"** si no (pago parcial: monto = recibido, y se elige otro método para el resto).
- **Tarjeta:** monto (por defecto, el pendiente; se puede bajar para pago combinado), referencia opcional (últimos 4 dígitos o número de autorización) y botón **"Pagado con tarjeta"**. El cobro se hace en la terminal externa.
- **Transferencia:** muestra los datos bancarios configurados (banco, titular, CLABE, cuenta o tarjeta); si hay varias cuentas, se elige una. Monto, referencia (obligatoria si así se configuró) y botón **"Marcar como pagada"**.
- **Pago combinado:** lista de pagos agregados con opción de quitar cada uno. Máximo un pago por método. Solo el efectivo puede exceder el pendiente y generar cambio. Ejemplo: $100 efectivo ("Agregar pago") + $50 tarjeta ("Pagado con tarjeta") = $150.
- **La venta se confirma en cuanto un pago deja el pendiente en cero**; no hay un segundo botón de confirmar. Al confirmar se crea la venta (folio del dispositivo, copia completa del carrito, pagos), se registra en el diario local, se dispara la impresión automática si está activada y se vuelve a Nueva venta con el carrito vacío mostrando el resultado.
- **Total en cero** (descuento del 100 %): el cobro muestra "Nada que cobrar" y un botón "Confirmar" que registra la venta sin pagos.
- "Volver a la venta" regresa sin perder nada (los pagos agregados se descartan).

Criterios de aceptación: la suma de los montos de los pagos es igual al total; el cambio sale solo del efectivo; la venta aparece de inmediato en el historial, también sin conexión, con la insignia "Por subir" hasta que se sincroniza.

### 5.4 Ticket

Contenido: logo, nombre de la cafetería, dirección, teléfono y RFC (si aplica y está activado), folio, fecha y hora, dispositivo, cajero, "Para:" si hay, productos con cantidad, tamaño, ingredientes (con cuántos fueron extra), opciones y nota, precio unitario cuando la cantidad es mayor a 1, importes, subtotal, descuento, total, desglose de IVA (si está activado), pagos (recibido y cambio en efectivo; referencia en tarjeta/transferencia) y mensaje final.

Formatos: 58 mm (32 columnas) y 80 mm (48 columnas). Ejemplo ilustrativo de 58 mm:

```
        CAFETERÍA DEMO
  Av. Juárez 123, Guadalajara
       Tel. 33 1234 5678
--------------------------------
Folio: A-000123
19/09/2026 08:42         Caja 1
Cajero: Ana
Para: Luis
--------------------------------
2 Latte Mediano 16 oz    $170.00
  2 x $85.00
  Almendra
1 Crepa dulce Grande      $85.00
  Nutella, Plátano, Fresa, Nuez
  (2 extra)
1 Brownie                 $45.00
  Nota: calientito
--------------------------------
Subtotal                 $215.00
Descuento 10%            -$21.50
TOTAL                    $193.50
IVA incluido 16%          $26.69
--------------------------------
Efectivo recibido        $200.00
Cambio                     $6.50
--------------------------------
    ¡Gracias por tu visita!
```

Opciones: imprimir (automático al cobrar o con botón), ticket digital (compartir el texto del ticket con la hoja de compartir del sistema; si no existe, copiar al portapapeles o abrir WhatsApp con el texto) y QR (fase opcional del plan). Una reimpresión lleva la marca `*** REIMPRESIÓN ***`; una venta cancelada, `*** VENTA CANCELADA ***`. También se imprime el **ticket de corte** (ver 5.7).

### 5.5 Menú: productos

Campos: nombre (obligatorio), imagen (opcional), categoría (obligatoria), precio base (≥ 0), tamaños, se arma con ingredientes, descripción, disponible / no disponible, orden en el menú y "Opciones adicionales" (grupos de modificadores asignados, en orden).

- **Tamaños:** se agregan a mano, con nombre libre ("Chica", "Grande", "12 oz") y precio. Nada automático ni global. Sin tamaños, el producto se vende a su precio base; con tamaños, el precio sale del tamaño elegido y el precio base se oculta. Se reordenan (el primero viene elegido en la venta), se quitan y se pueden copiar de otro producto ("Copiar tamaños de…"). No puede haber dos tamaños con el mismo nombre.
- **Se arma con ingredientes** (interruptor): ingredientes incluidos por tamaño (o uno solo si no hay tamaños), precio por ingrediente extra, mínimo y máximo de ingredientes (máximo vacío = sin límite) e ingredientes permitidos: todos, o una selección (con filtro por grupo y "Marcar todos").
- **Opciones adicionales:** todos los grupos de extras/modificadores con una casilla para asignarlos; los asignados van primero y se ordenan con subir/bajar (ese es el orden en la venta).

Ejemplos: **Latte**, tamaños Chico 12 oz $65, Mediano 16 oz $75 y Grande 20 oz $85, con Leche, Extra shot, Jarabes y Toppings. **Crepa dulce**, tamaños Chica $55 y Grande $75 (cada uno incluye 2 ingredientes), ingrediente extra $5, mínimo 1, máximo 5, permitidos los Dulces.

- Lista con buscador y filtro por categoría; interruptor de disponible directo en la lista; reordenar con botones subir/bajar.
- Los precios (base, de cada tamaño y del ingrediente extra) solo se editan con `modificarPrecios` (o autorización por PIN); sin ese permiso son de solo lectura y no se pueden agregar, quitar ni copiar tamaños. El resto (nombres de tamaños, orden, incluidos, mínimo, máximo, permitidos) requiere `crearProductos`.
- Imagen: tomar foto o elegir archivo, recorte cuadrado, se guarda comprimida (256×256, WebP, ~60 KB máximo) dentro del producto.
- Eliminar con confirmación. Las ventas pasadas no se afectan porque guardan copia.
- Los cambios se ven al instante en Nueva venta, incluso sin conexión en el mismo dispositivo.

### 5.6 Menú: categorías, ingredientes y modificadores

**Categorías:** crear, editar (nombre y color de una paleta de 8), eliminar (solo si no tiene productos; si tiene: "Mueve o elimina sus productos primero"), cambiar orden y activar/desactivar (una categoría inactiva no aparece en Nueva venta).

**Ingredientes:** alta rápida (nombre y grupo opcional, Enter agrega el siguiente), editar, reordenar, disponible / no disponible y eliminar (se quita de los productos que lo permitían; las ventas pasadas no cambian). Sin precio propio.

**Grupos de modificadores:** nombre ("Leche"), tipo (una opción / varias opciones), obligatorio sí/no, mínimo y máximo (para varias opciones), orden y opciones. Cada opción: nombre, precio extra (≥ 0), por defecto sí/no y disponible sí/no. Un grupo se reutiliza en muchos productos.

Ejemplo:

| Grupo | Tipo | Obligatorio | Opciones |
|---|---|---|---|
| Leche | una | sí | Entera +$0 (por defecto), Deslactosada +$5, Almendra +$10 |
| Jarabes | varias (máx. 2) | no | Vainilla +$10, Caramelo +$10, Avellana +$10 |

### 5.7 Caja

**Abrir caja:** monto inicial (fondo). Un solo turno abierto por dispositivo. Requiere `abrirCaja`.

**Caja actual y cierre (una sola pantalla):** estado, quién abrió y cuándo, fondo inicial, ventas del turno (número y total por método), entradas, retiros, gastos, devoluciones en efectivo y **efectivo esperado**, junto al conteo para cerrar. El esperado lo ve quien puede cerrar caja (`cerrarCaja`, o con autorización) o ver reportes. Botones: "Registrar entrada", "Registrar retiro", "Registrar gasto" y "Cerrar caja".

**Dispositivos:** el Administrador ve en Configuración › Dispositivo la lista de las demás tablets (nombre, tipo, letra y último folio) y puede **desactivarlas**. Una tablet desactivada deja de vender y de abrir caja (se comporta como de consulta); sus ventas, turnos y folios se conservan. Los dispositivos nunca se borran.

**Movimientos:** requieren turno abierto y `registrarGastos`. Tipos: entrada (por ejemplo, cambio o fondo adicional), retiro (por ejemplo, el dueño se lleva efectivo) y gasto (categoría + concepto + monto, por ejemplo hielo, insumos o pago pequeño a proveedor). Categorías de gasto configurables. Un movimiento equivocado se **anula** (queda visible y tachado, no suma); nunca se borra.

**Cerrar caja** (requiere `cerrarCaja`):

1. Contar efectivo: por denominaciones (billetes de 1000, 500, 200, 100, 50, 20; monedas de 20, 10, 5, 2, 1 y 0.50) o capturando el total directo.
2. En la misma pantalla, mientras se cuenta: efectivo esperado, efectivo contado y diferencia en vivo (sobrante en verde, faltante en rojo), con los totales del turno. Nota opcional. (Ya no es corte ciego: a pedido de Bruno, quien cierra ve cuánto debe haber.)
3. Confirmar: el turno queda cerrado con su resumen guardado (ya no cambia). Opción de imprimir el corte. Si hay ventas por subir: "Hay 3 ventas por subir; se subirán solas." (no impide cerrar).

**Cortes de caja:** historial (fecha, dispositivo, quién abrió y cerró, total vendido, diferencia) y detalle con reimpresión.

### 5.8 Ventas: historial y devoluciones

**Historial:** por defecto, hoy. Filtros: rango de fechas, método de pago, cajero, estado y búsqueda por folio. Cada fila: folio, hora, resumen de productos, total, métodos, cajero, estado (Pagada, Cancelada, Devuelta, Devuelta parcial) e insignia "Por subir" si aplica.

**Detalle:** vista del ticket y acciones:

- **Ver ticket** y **Reimprimir**.
- **Cancelar venta:** solo si el turno de esa venta sigue abierto y la venta está pagada. Motivo obligatorio. Requiere `cancelarVentas` o autorización. La venta queda "Cancelada" y deja de contar en totales (el dinero se devolvió en el momento).
- **Devolución:** para ventas pagadas o devueltas parcialmente, de cualquier turno. Se eligen líneas y cantidades (o todo), método de reembolso (en efectivo requiere un turno abierto en este dispositivo) y motivo. Requiere `cancelarVentas` o autorización. El monto se calcula proporcional al descuento (ver §6). Crea un registro en `devoluciones`, suma a `devuelto` de la venta y cambia su estado. El efectivo devuelto resta del efectivo esperado del turno donde se hizo la devolución.

**Devoluciones:** lista con filtros por fecha, con enlace a la venta original.

### 5.9 Gastos de caja

Se registran desde Caja › Movimientos como tipo gasto (ver 5.7): concepto, monto, categoría, fecha y usuario. Ejemplos: compra de hielo, insumos, pago pequeño a proveedor. "Cambio para caja" se registra como **entrada** (dinero que entra al cajón). Los reportes muestran gastos por categoría.

### 5.10 Reportes

Requiere `verReportes`. Rango: Hoy, Ayer, Esta semana, Este mes o Personalizado (máximo 92 días).

- **Resumen:** ventas brutas, cancelaciones (número e importe), devoluciones, ventas netas, número de ventas, ticket promedio, descuentos, totales por efectivo, tarjeta y transferencia, gastos. Barras por hora (si el rango es un día) o por día.
- **Productos:** producto, categoría, cantidad, importe y porcentaje; ordenable por importe o cantidad; los 10 más vendidos destacados.
- **Categorías:** cantidad e importe por categoría.
- **Cajeros:** ventas, total, ticket promedio y cancelaciones por cajero.
- **Cortes:** cortes del rango con su diferencia.
- **Exportar CSV** de cada pestaña (UTF-8 con BOM para que Excel respete acentos).
- La tablet guarda los últimos 35 días, así que esos rangos funcionan sin conexión (con el aviso "Sin conexión: puede faltar información reciente de otros dispositivos."). Rangos más antiguos se consultan al servidor y requieren internet: "Sin conexión: solo están disponibles los últimos 35 días."

### 5.11 Usuarios

Solo Administrador. Lista con nombre, rol y estado. Crear o editar: nombre, rol, PIN (4–6 dígitos, único, con confirmación) y activo sí/no. Los usuarios no se borran, se desactivan (las ventas guardan su nombre). No se puede desactivar ni cambiar de rol al último Administrador activo. **Roles y permisos:** matriz editable para Encargado y Cajero.

### 5.12 Configuración

Solo Administrador.

- **Negocio:** nombre, logo (comprimido), dirección, teléfono, RFC (opcional) y categorías de gasto.
- **Impuestos y descuentos:** precios incluyen IVA (sí por defecto), tasa (16 %), mostrar desglose de IVA en el ticket; permitir descuentos y porcentaje máximo.
- **Pagos:** tarjeta y transferencia activadas o no (efectivo siempre), cuentas bancarias para transferencia (banco, titular, CLABE, cuenta o tarjeta, alias) y referencia de transferencia obligatoria sí/no.
- **Ticket:** ancho (58/80 mm), mostrar logo, dirección, teléfono, RFC y cajero, mensaje final, imprimir al cobrar. Vista previa en vivo.
- **Impresora** (por dispositivo, se guarda localmente): tipo de conexión (Navegador, USB o Bluetooth, según lo que soporte el dispositivo), conectar y "Imprimir prueba".
- **Dispositivo:** nombre, prefijo de folio, tipo, bloqueo automático (minutos, 0 = nunca) y estado del almacenamiento persistente.

## 6. Cálculos (fuente de verdad para las pruebas)

Todo en centavos enteros. Redondeo al centavo más cercano (mitades hacia arriba).

- `precioBase = precio del tamaño elegido` (o el precio del producto si no tiene tamaños)
- `extrasIngredientes = max(0, ingredientes elegidos − incluidos del tamaño)` (elegir menos no descuenta)
- `precioUnitario = precioBase + extrasIngredientes × precioIngredienteExtra + Σ precioExtra de las opciones elegidas`
- `importeLinea = precioUnitario × cantidad`
- `subtotal = Σ importeLinea`
- Descuento en porcentaje `p`: `redondear(subtotal × p / 100)`. En monto `m`: `min(m, subtotal)`.
- `neto = subtotal − descuento`
- **IVA incluido** (por defecto): `total = neto`; `base = redondear(total / (1 + tasa))`; `iva = total − base`.
- **IVA no incluido:** `iva = redondear(neto × tasa)`; `total = neto + iva`.
- Pago en efectivo: `monto = min(recibido, pendiente)`; `cambio = recibido − monto`.
- Reembolso de una devolución: `redondear(Σ importeLinea devuelta × total / subtotal)`, sin exceder `total − devuelto`.
- `efectivoEsperado = fondoInicial + Σ efectivo de ventas no canceladas del turno + entradas − retiros − gastos − devoluciones en efectivo del turno` (movimientos anulados no cuentan).
- `diferencia = contado − esperado` (positiva = sobrante, negativa = faltante).

| # | Caso | Resultado esperado |
|---|---|---|
| A | Latte Mediano $75 + Almendra $10, cantidad 2; Brownie $45 | precio unitario $85; subtotal $215.00 |
| B | A con descuento 10 %, IVA incluido 16 % | descuento $21.50; total $193.50; base $166.81; IVA $26.69 |
| C | Como B pero IVA no incluido | IVA $30.96; total $224.46 |
| D | Total $193.50, efectivo recibido $200 | cambio $6.50 |
| E | Total $150: efectivo recibido $100, luego tarjeta $50 | pendiente $0; cambio $0 |
| F | Total $150: tarjeta $100, luego efectivo recibido $100 | efectivo aplicado $50; cambio $50 |
| G | Descuento de $60 sobre subtotal $45 | descuento $45; total $0; se confirma sin pagos |
| H | Fondo $500; ventas en efectivo $1,250; entrada $200; retiro $300; gasto $80; devolución en efectivo $45; contado $1,510 | esperado $1,525; diferencia −$15 (faltante) |
| I | Devolver 1 Brownie ($45) de la venta B | reembolso $40.50 |
| J | Latte Grande $85 + Avena $10 + 1 shot $15 + Vainilla $10 + Caramelo $10 | $130; una tercera opción de Jarabes (máx. 2) no se permite |
| K | Crepa Grande $75 (incluye 2), ingrediente extra $5, con 4 ingredientes | $85 (2 extra) |
| L | Crepa Chica $55 (incluye 2) con 1 ingrediente | $55 (no descuenta) |
| M | Crepa con máximo 5 y mínimo 1 | no deja elegir un sexto; sin ingredientes no se puede agregar |

## 7. Flujos críticos y presupuesto de toques

Desde la pantalla de venta con el carrito vacío y la caja abierta:

| Flujo | Toques | Secuencia |
|---|---|---|
| Americano chico, efectivo exacto | ≤ 5 | Americano → Agregar → Cobrar → Exacto → Confirmar cobro |
| Brownie, tarjeta | ≤ 4 | Brownie → Cobrar → Tarjeta → Pagado con tarjeta |
| Latte mediano con almendra, efectivo $100 | ≤ 7 | Latte → Mediano → Almendra → Agregar → Cobrar → $100 → Confirmar cobro |

Estos flujos llevan prueba e2e que cuenta los toques.

## 8. Casos borde

- **Recarga o cierre a media venta:** el carrito se recupera.
- **Venta sin conexión y luego la app se cierra:** la venta y su operación pendiente quedan en la tablet (IndexedDB) y se suben al volver la conexión (ver `02-arquitectura.md` §6).
- **Sesión del dispositivo expirada o cuenta desactivada:** se pide iniciar sesión otra vez sin perder las ventas pendientes de subir.
- **Escritura rechazada al sincronizar:** aviso persistente con el folio para el Administrador y botón "Reintentar".
- **Dos dispositivos con el mismo prefijo:** se valida al configurar el dispositivo (con conexión) y se advierte.
- **Caja abierta varios días:** se permite, con aviso en Inicio.
- **Producto eliminado o con precio cambiado mientras está en el carrito:** la línea conserva lo que tenía al agregarse.
- **Ventas anteriores a los tamaños:** no traen `tamano` ni `ingredientes`; se muestran e imprimen como antes (el tamaño venía dentro de los modificadores).
- **Grupo global "Tamaño" de versiones anteriores:** la migración lo convierte en tamaños de cada producto que lo usaba (precio base + precio extra, la opción por defecto primero) y lo elimina.
- **Último Administrador:** no se puede desactivar ni degradar.
- **PIN repetido:** no se permite.
- **Reloj del dispositivo incorrecto:** fuera de alcance; se documenta en el README.
