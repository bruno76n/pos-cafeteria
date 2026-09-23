# 03 · Interfaz

## 1. A quién sirve y para qué

Un cajero detrás de la barra, con prisa, a veces con las manos húmedas, con fila enfrente y la máquina de espresso sonando. La interfaz es una herramienta de trabajo: se lee de un vistazo, se toca sin apuntar y nunca hace dudar sobre cuánto cobrar o cuánto cambio dar.

## 2. Dirección visual: "barra de acero"

La referencia es el mostrador de una cafetería de especialidad: el acero de la máquina, el papel del ticket y el verde de la planta de café. Evitamos a propósito crema + terracota: es lo primero que se le ocurre a cualquiera para una cafetería y también el aspecto típico de las interfaces genéricas.

**Lo memorable es una sola cosa:** la barra verde de **Cobrar** con el total en números grandes. Todo lo demás es callado: blanco, gris acero, grafito, sin sombras decorativas.

### Paleta

| Nombre | Hex | Uso |
|---|---|---|
| Acero | `#F2F4F3` | Fondo de la app |
| Papel | `#FFFFFF` | Superficies: botones de producto, carrito, formularios |
| Grafito | `#1E2528` | Texto principal, opción seleccionada, íconos |
| Grafito suave | `#5B676C` | Texto secundario, etiquetas |
| Línea | `#D5DCDA` | Bordes y divisores |
| Cafeto | `#1F6F4A` | Solo acciones de dinero y confirmación: Cobrar, Confirmar cobro, Agregar $… (presionado `#175A3B`) |
| Faltante | `#B3372F` | Errores, cancelar, diferencia negativa |
| Ámbar | `#8A5A12` sobre `#FFF4DE` | Sin conexión, por subir, avisos |

El verde se reserva para el dinero. Si todo es verde, nada lo es.

**Colores de categoría** (franja de 6 px en el borde izquierdo de cada botón de producto; nunca como fondo de texto): `#6B4226` tostado, `#2F7CA6` hielo, `#B8862B` mostaza, `#A83E5B` frambuesa, `#5E6B73` pizarra, `#4B7F52` hoja, `#7A5AA6` lavanda, `#C2553A` canela.

### Tipografía

Una sola familia: **Atkinson Hyperlegible Next** (diseñada para máxima legibilidad; ideal para leer precios de reojo). Autoalojada, porque la app debe funcionar sin internet: paquete de Fontsource si existe; si no, archivos `woff2` en `public/fuentes/`. Respaldo: `system-ui, sans-serif`. Si no se puede instalar, usa el respaldo y anótalo en la bitácora.

| Uso | Tamaño | Peso |
|---|---|---|
| Etiquetas y metadatos | 14 px | 400 |
| Texto normal | 16 px | 400 |
| Nombre en botón de producto | 18 px | 600 |
| Títulos de sección | 22 px | 600 |
| Títulos de pantalla | 28 px | 700 |
| Total en la barra de Cobrar | 40 px | 800 |
| Cambio después de cobrar | 64 px | 800 |

Números siempre con `font-variant-numeric: tabular-nums` y alineados a la derecha en tablas y totales. Mayúsculas y minúsculas normales (sentence case): nada de etiquetas en MAYÚSCULAS.

### Medidas

- Base de espaciado 4 px. Márgenes de pantalla 16 px, separación entre botones de producto 12 px.
- Radios: 10 px en botones y productos, 16 px en hojas y modales.
- Tamaño táctil mínimo 48 px; acciones principales 64–72 px de alto.
- Estados: presionado (fondo un tono más oscuro y escala 0.98), deshabilitado (40 % de opacidad), foco visible (anillo de 3 px Cafeto).
- Movimiento solo como respuesta a una acción: la hoja sube en 150 ms; la línea recién agregada al carrito se resalta 200 ms. Respeta `prefers-reduced-motion`.

Los tokens van como variables CSS en `src/estilos/global.css` (bloque `@theme` de Tailwind v4) y los mismos colores en el manifest (`theme_color` Grafito, `background_color` Acero).

## 3. Estructura general

Tablet horizontal (1280×800 y 1180×820 como referencia; mínimo 1024×768).

- **Barra superior (56 px):** a la izquierda, nombre del negocio y del dispositivo; a la derecha, indicador de conexión y el usuario activo (al tocarlo: "Cambiar usuario" y "Bloquear").
- **Riel lateral (80 px):** íconos con etiqueta debajo: Inicio, Venta, Ventas, Menú, Caja, Reportes, Usuarios, Configuración. Solo se muestran las secciones permitidas al usuario activo.
- **Subsecciones como pestañas** arriba del contenido (por ejemplo, en Menú: Productos, Categorías, Ingredientes y Modificadores). Así respetamos el menú final sin menús anidados:

```
INICIO
NUEVA VENTA
VENTAS         → Historial | Devoluciones
MENÚ           → Productos | Categorías | Ingredientes | Modificadores
CAJA           → Caja actual | Movimientos | Cortes de caja
REPORTES
USUARIOS       → Usuarios | Roles y permisos
CONFIGURACIÓN  → Negocio | Impuestos | Pagos | Ticket | Dispositivo
```

- **Vertical y celular:** el riel pasa a barra inferior con 5 accesos (Inicio, Venta, Ventas, Caja, Más). En Nueva venta, el carrito se vuelve una barra inferior con "Ver venta (3)" a la izquierda y "Cobrar $193.50" a la derecha, que abre una hoja. Inicio y Reportes deben verse bien en el celular del dueño.

## 4. Pantallas

### Bloqueo (PIN)

```
┌──────────────────────────────────────────┐
│             Cafetería Demo               │
│                 Caja 1                   │
│                                          │
│             Escribe tu PIN               │
│               ●  ●  ○  ○                 │
│                                          │
│            [ 1 ] [ 2 ] [ 3 ]             │
│            [ 4 ] [ 5 ] [ 6 ]             │
│            [ 7 ] [ 8 ] [ 9 ]             │
│                  [ 0 ] [ ⌫ ]             │
└──────────────────────────────────────────┘
```

Teclas de 72 px. Se valida sola al completar un PIN que coincide (4–6 dígitos). Error: "PIN incorrecto." Tras 5 intentos: "Espera 30 segundos para intentar de nuevo."

### Nueva venta

```
┌─────┬────────────────────────────────────────────────┬──────────────────────────┐
│     │ [Crepas] [Cafés] [Bebidas frías] [Alimentos]   │ Venta actual             │
│ Ini │ [Postres] [Extras]              [ Buscar… ]    │ Para: [______________]   │
│     │                                                │                          │
│ Ven │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐ │ 2  Latte Mediano 16 oz   │
│     │ ▌Espresso │ ▌Americano│ ▌Capuchino│ ▌Latte │ │    Almendra     $170.00  │
│ Vtas│ ▌         │ ▌         │ ▌         │ ▌      │ │    [−] [+]  Nota  [🗑]   │
│     │ ▌$40.00   │ ▌Desde $45│ ▌Desde $62│ ▌Desde │ │ 1  Brownie       $45.00  │
│ Menú│ └──────────┘ └──────────┘ └──────────┘ └─────┘ │                          │
│     │ ┌──────────┐ ┌──────────┐ ┌──────────┐         │ Subtotal        $215.00  │
│ Caja│ ▌Flat white│ ▌Moka     │ ▌Chai latte│         │ Descuento 10%   −$21.50  │
│     │ ▌$62.00   │ ▌$72.00   │ ▌$68.00   │         │ IVA incluido     $26.69  │
│ Rep │ └──────────┘ └──────────┘ └──────────┘         │ [Descuento]   [Vaciar]   │
│     │                                                │┌────────────────────────┐│
│ Conf│                                                ││ Cobrar       $193.50   ││
│     │                                                │└────────────────────────┘│
└─────┴────────────────────────────────────────────────┴──────────────────────────┘
```

- Cuadrícula `repeat(auto-fill, minmax(140px, 1fr))`, botones de 104 px de alto: nombre (hasta 2 líneas) arriba, precio abajo a la izquierda ("Desde $55.00" si tiene tamaños), franja de color de categoría a la izquierda. Imagen opcional pequeña a la derecha si el producto tiene. No disponible: 40 % de opacidad y etiqueta "No disponible".
- Carrito de 380 px (340 px en 1024). La barra Cobrar mide 72 px, fondo Cafeto, texto blanco, total a 40 px. Deshabilitada con carrito vacío.
- Carrito vacío después de una venta: muestra "Venta A-000123", la etiqueta "Cambio" con **$6.50** a 64 px y los botones "Imprimir ticket" y "Compartir". Desaparece al agregar el siguiente producto.
- Carrito vacío sin venta previa: "Toca un producto para empezar."

### Hoja de personalización

Orden fijo: **Tamaño → Ingredientes → Extras → Nota → Cantidad**. Cada sección aparece solo si el producto la usa.

```
┌──────────────────────── Crepa dulce  $75.00 ──────────────────── [✕] ┐
│ Tamaño                                                               │
│ [ Chica $55 ] [■ Grande $75 ]                                        │
│ Ingredientes                                                         │
│ Incluye 2. Cada extra +$5.00. Máximo 5          3 elegidos: 1 extra  │
│ Dulces                                                               │
│ [■ Nutella ] [ Cajeta ] [ Lechera ] [■ Plátano ] [■ Fresa ] …        │
│ Toppings (hasta 3)                                                   │
│ [ Crema batida +$10 ] [ Canela ] [ Cocoa ] …                         │
│ Nota  [____________________________]                                 │
│                                                                      │
│ Cantidad  [ − ]  1  [ + ]                   [   Agregar  $80.00   ]  │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌───────────────────────────── Latte  $75.00 ───────────────────── [✕] ┐
│ Tamaño                                                               │
│ [ Chico 12 oz $65 ] [■ Mediano 16 oz $75 ] [ Grande 20 oz $85 ]      │
│ Leche (elige 1)                                                      │
│ [■ Entera ] [ Deslactosada +$5 ] [ Light ] [ Almendra +$10 ] …       │
│ Extra shot (opcional)                                                │
│ [ 1 shot extra +$15 ] [ 2 shots extra +$30 ]                         │
│ Jarabes (hasta 2)                                                    │
│ [ Vainilla +$10 ] [ Caramelo +$10 ] [ Avellana +$10 ] …              │
│ Nota  [____________________________]                                 │
│                                                                      │
│ Cantidad  [ − ]  1  [ + ]                   [   Agregar  $75.00   ]  │
└──────────────────────────────────────────────────────────────────────┘
```

Opciones como botones de 56 px; la elegida en Grafito con texto blanco. Los precios en Grafito suave (el tamaño con su precio; los extras con "+"). Ingredientes como botones de 64 px en cuadrícula, agrupados por grupo; al llegar al máximo los demás se apagan y los no disponibles salen apagados. Si falta algo obligatorio, el botón Agregar dice qué falta ("Elige al menos 1 ingrediente", "Elige leche") y está deshabilitado. En tablet es una hoja que sube desde abajo, de máximo 760 px de ancho.

### Cobro

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [← Volver a la venta]                          Total a cobrar  $193.50  │
│                                                                         │
│ [ Efectivo ]  [ Tarjeta ]  [ Transferencia ]  │ Pagos                   │
│                                               │ (ninguno todavía)       │
│ Recibido                     $200.00          │                         │
│ [ Exacto ] [ $200 ] [ $500 ] [ $1000 ]        │ Pendiente     $193.50   │
│                                               │                         │
│ [ 7 ] [ 8 ] [ 9 ]      Cambio                 │                         │
│ [ 4 ] [ 5 ] [ 6 ]      $6.50                  │                         │
│ [ 1 ] [ 2 ] [ 3 ]                             │                         │
│ [ 0 ] [ 00 ] [ ⌫ ]                            │                         │
│ ┌───────────────────────────────────────┐     │                         │
│ │            Confirmar cobro            │     │                         │
│ └───────────────────────────────────────┘     │                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Teclas de 64 px; el cambio en 48 px. El botón de acción vive en el panel de cada método, en Cafeto y a 72 px de alto: en Efectivo dice "Confirmar cobro" si lo recibido cubre el pendiente o "Agregar pago" si no; en Tarjeta, "Pagado con tarjeta" (con monto y referencia opcional); en Transferencia, "Marcar como pagada" (con la tarjeta de datos bancarios: banco, titular y CLABE en grupos de 4 para dictarla fácil, más la referencia). En cuanto el pendiente llega a cero la venta se confirma. La columna derecha solo lista los pagos agregados (con "Quitar") y el pendiente.

### Caja actual y cierre

- Caja cerrada: "La caja está cerrada" + campo "Fondo inicial" + botón "Abrir caja".
- Caja abierta y cierre **en la misma pantalla**: encabezado "Abierta por Ana desde las 7:02" y botones "Registrar entrada", "Registrar retiro", "Registrar gasto". A la izquierda, "Cerrar caja · Contar efectivo": tabla de denominaciones con teclado numérico (piezas por fila y subtotal) o "Capturar total". A la derecha (fija al desplazar): efectivo esperado, efectivo contado, diferencia grande en vivo ("Cuenta el efectivo" antes de contar; luego "Faltan $15.00" en Faltante / "Sobran $20.00" en Cafeto / "Cuadra exacto"), nota, botón "Cerrar caja" en Grafito (deshabilitado hasta contar) y debajo los totales del turno. Sin `cerrarCaja`: "Pedir autorización para cerrar caja" y el esperado solo con `verReportes`. Al cerrar: "Caja cerrada. Diferencia: …" → "Imprimir corte".

### Historial y detalle

Tabla con filas de 56 px: folio, hora, productos (una línea, truncada), total (derecha), método(s), cajero, estado. Insignias: Cancelada (Faltante), Devuelta y Devuelta parcial (Ámbar), Por subir (Ámbar con ícono de nube). Detalle: ticket a la izquierda como vista previa, acciones a la derecha (Reimprimir, Compartir, Cancelar venta, Devolución).

### Menú

Lista de productos con miniatura, nombre, categoría, precio ("Desde $55.00" si tiene tamaños), interruptor "Disponible", botones subir/bajar, "Editar" y eliminar (bote, con confirmación). Formulario con vista previa del botón como se verá en Nueva venta y, en este orden: nombre, categoría, precio base (se oculta si hay tamaños), **Tamaños** (filas nombre + precio, subir/bajar, quitar, "Agregar tamaño", "Copiar tamaños de…"), **Se arma con ingredientes** (interruptor; incluidos por tamaño, "Precio por ingrediente extra", Mínimo, Máximo con "Sin límite", permitidos Todos/Elegir con filtro por grupo y casillas), descripción, imagen, disponible y **Opciones adicionales** (todos los grupos con casilla; los marcados primero, con subir/bajar). Categorías: lista con color, activa y orden. Ingredientes: alta rápida arriba (nombre, grupo con sugerencias, Agregar) y lista con grupo, disponible, subir/bajar, editar y eliminar. Modificadores: lista de grupos; al editar, tabla de opciones con precio extra y "por defecto".

### Inicio y reportes

Nada de tarjetas idénticas con sombra. Inicio: columna izquierda con las cifras de hoy como una lista de renglones grandes (Total vendido, Ventas, Ticket promedio y por método), columna derecha con la caja actual y "Más vendidos hoy". Reportes: selector de rango arriba, pestañas, tablas y barras horizontales simples hechas con CSS.

## 5. Textos

Sentence case, verbos concretos, sin relleno. Una acción conserva su nombre en todo el flujo: el botón "Cerrar caja" produce el aviso "Caja cerrada".

| Situación | Texto | Botones |
|---|---|---|
| Sin caja abierta | "Abre la caja para empezar a vender." | "Abrir caja" |
| Sin conexión | "Sin conexión. Las ventas se guardan en esta tablet y se suben solas." | – |
| Ventas pendientes | "3 ventas por subir" | – |
| Error de subida | "La venta A-000123 no se pudo subir." | "Reintentar" |
| Sin permiso | "Tu usuario no puede cancelar ventas." | "Pedir autorización" |
| Impresora | "No se pudo imprimir: la impresora no responde. Revisa que esté encendida y vuelve a intentar." | "Reintentar" |
| Historial vacío | "Todavía no hay ventas hoy." | "Nueva venta" |
| Menú vacío | "Aún no hay productos." | "Agregar producto", "Cargar menú de ejemplo" |
| Confirmar vaciar | "¿Vaciar la venta? Se quitarán 3 productos." | "Vaciar", "Conservar" |
| Cancelar venta | "Cancelar la venta A-000123 por $193.50" + campo "Motivo" | "Cancelar venta", "Volver" |
| Caja cerrada | "Caja cerrada. Diferencia: faltan $15.00." | "Imprimir corte" |
| Actualización | "Hay una versión nueva." | "Actualizar" |
| Base local bloqueada | "Hay que terminar de actualizar la app. Cierra las otras pestañas o ventanas de la app (incluida la app instalada) y vuelve a abrir esta." | "Recargar" |

Los errores explican qué pasó y qué hacer, sin disculpas. Los estados vacíos invitan a la acción.

## 6. Accesibilidad y calidad

Contraste mínimo 4.5:1 en texto (la paleta ya lo cumple sobre Papel y Acero). Foco visible con teclado. Etiquetas en todos los campos. Íconos siempre acompañados de texto o `aria-label`. Nada depende de hover. `prefers-reduced-motion` respetado. Revisa cada pantalla en 1280×800, 1024×768, vertical 800×1280 y celular 390×844 (tomando capturas con Playwright si ayuda).
