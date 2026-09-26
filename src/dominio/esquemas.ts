import { z } from 'zod';

// Esquemas Zod de todas las entidades (docs/02-arquitectura.md §5). Los usan la app y la API.

export const PERMISOS = [
  'vender',
  'aplicarDescuentos',
  'cancelarVentas',
  'modificarPrecios',
  'crearProductos',
  'abrirCaja',
  'cerrarCaja',
  'verReportes',
  'registrarGastos',
] as const;

export const ROLES = ['admin', 'encargado', 'cajero'] as const;
export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'] as const;

export const TABLAS_SYNC = [
  'config',
  'categorias',
  'gruposModificadores',
  'ingredientes',
  'productos',
  'usuarios',
  'dispositivos',
  'turnos',
  'movimientos',
  'ventas',
  'devoluciones',
] as const;

export const id = z.string().min(1).max(100);
export const fecha = z.iso.datetime({ offset: true });
export const dia = z.iso.date();
export const centavos = z.number().int();
export const centavosPositivos = centavos.nonnegative();
export const permiso = z.enum(PERMISOS);
export const rol = z.enum(ROLES);
export const metodoPago = z.enum(METODOS_PAGO);
export const refUsuario = z.object({ id, nombre: z.string().min(1) });

/** Campo común de todo registro sincronizable: hora del dispositivo que hizo el último cambio. */
const sincronizable = { actualizadoEn: fecha };

const permisosDeRol = z.object(
  Object.fromEntries(PERMISOS.map((p) => [p, z.boolean()])) as {
    [K in (typeof PERMISOS)[number]]: z.ZodBoolean;
  },
);

export const esquemaCuentaBancaria = z.object({
  id,
  banco: z.string(),
  titular: z.string(),
  clabe: z.string(),
  cuenta: z.string(),
  alias: z.string(),
});

export const esquemaConfigGeneral = z.object({
  negocio: z.object({
    nombre: z.string().min(1),
    logo: z.string().nullable(),
    direccion: z.string(),
    telefono: z.string(),
    rfc: z.string(),
  }),
  ventas: z.object({
    preciosIncluyenIVA: z.boolean(),
    tasaIVA: z.number().min(0).max(1),
    mostrarDesgloseIVA: z.boolean(),
    descuentosPermitidos: z.boolean(),
    descuentoMaximoPorcentaje: z.number().min(0).max(100),
  }),
  pagos: z.object({
    tarjeta: z.boolean(),
    transferencia: z.boolean(),
    referenciaTransferenciaObligatoria: z.boolean(),
    cuentas: z.array(esquemaCuentaBancaria),
  }),
  // El ancho del papel y "imprimir al cobrar" son de cada dispositivo (Configuración › Impresora).
  ticket: z.object({
    mostrarLogo: z.boolean(),
    mostrarDireccion: z.boolean(),
    mostrarTelefono: z.boolean(),
    mostrarRFC: z.boolean(),
    mostrarCajero: z.boolean(),
    mensajeFinal: z.string(),
    /** QR con enlace al ticket digital (opcional; configuraciones anteriores no lo traen). */
    mostrarQR: z.boolean().optional(),
    /** Comanda de cocina (opcional; sin él se imprime, cocina primero, 1 copia). */
    comanda: z
      .object({
        imprimir: z.boolean(),
        orden: z.enum(['cocina', 'cliente']),
        copias: z.number().int().min(1).max(3),
      })
      .optional(),
  }),
  gastos: z.object({ categorias: z.array(z.string().min(1)) }),
  roles: z.object({ encargado: permisosDeRol, cajero: permisosDeRol }),
  zonaHoraria: z.string().min(1),
});

export const esquemaConfig = z.object({
  id: z.literal('general'),
  datos: esquemaConfigGeneral,
  ...sincronizable,
});

export const esquemaCategoria = z.object({
  id,
  nombre: z.string().trim().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  orden: z.number().int(),
  activa: z.boolean(),
  ...sincronizable,
});

export const esquemaOpcionModificador = z.object({
  id,
  nombre: z.string().trim().min(1),
  precioExtra: centavosPositivos,
  porDefecto: z.boolean(),
  disponible: z.boolean(),
});

export const esquemaGrupoModificadores = z
  .object({
    id,
    nombre: z.string().trim().min(1),
    tipo: z.enum(['unico', 'multiple']),
    obligatorio: z.boolean(),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    orden: z.number().int(),
    opciones: z.array(esquemaOpcionModificador),
    ...sincronizable,
  })
  .refine((g) => g.min <= g.max, { message: 'El mínimo no puede ser mayor que el máximo', path: ['min'] });

/** Ingrediente del catálogo (sin precio: el precio del extra lo define cada producto). */
export const esquemaIngrediente = z.object({
  id,
  nombre: z.string().trim().min(1),
  /** "Dulces", "Salados"… (opcional). */
  grupo: z.string().trim().min(1).nullable(),
  orden: z.number().int(),
  disponible: z.boolean(),
  ...sincronizable,
});

/** Tamaño propio de un producto. El primero es el que viene elegido en la venta. */
export const esquemaTamano = z.object({
  id,
  nombre: z.string().trim().min(1),
  precio: centavosPositivos,
  /** Ingredientes incluidos en este tamaño (solo cuenta si el producto se arma con ingredientes). */
  incluidos: z.number().int().nonnegative().default(0),
});

/** Producto que se arma con ingredientes del catálogo (crepas, baguettes…). */
export const esquemaArmado = z
  .object({
    /** Incluidos cuando el producto no tiene tamaños (con tamaños, cada tamaño trae los suyos). */
    incluidos: z.number().int().nonnegative(),
    /** Precio de cada ingrediente después de los incluidos. */
    precioExtra: centavosPositivos,
    min: z.number().int().nonnegative(),
    /** null = sin límite. */
    max: z.number().int().positive().nullable(),
    /** Ids de ingredientes permitidos; null = todos. */
    permitidos: z.array(id).nullable(),
  })
  .refine((a) => a.max === null || a.min <= a.max, {
    message: 'El mínimo de ingredientes no puede ser mayor que el máximo',
    path: ['min'],
  });

export const esquemaProducto = z
  .object({
    id,
    nombre: z.string().trim().min(1),
    descripcion: z.string(),
    categoriaId: id,
    /** Precio base; si hay tamaños, el precio sale del tamaño elegido. */
    precio: centavosPositivos,
    imagen: z.string().startsWith('data:image/').nullable(),
    disponible: z.boolean(),
    orden: z.number().int(),
    gruposIds: z.array(id),
    tamanos: z.array(esquemaTamano).default([]),
    /** null = no se arma con ingredientes. */
    armado: esquemaArmado.nullable().default(null),
    /** Sale en la comanda de cocina (apagado: agua embotellada, café en grano…). */
    vaACocina: z.boolean().default(true),
    ...sincronizable,
  })
  .refine((p) => new Set(p.tamanos.map((t) => t.nombre.toLowerCase())).size === p.tamanos.length, {
    message: 'Hay dos tamaños con el mismo nombre',
    path: ['tamanos'],
  });

export const esquemaUsuario = z.object({
  id,
  nombre: z.string().trim().min(1),
  rol,
  pinHash: z.string().regex(/^[0-9a-f]{64}$/),
  pinSal: z.string().regex(/^[0-9a-f]{32}$/),
  activo: z.boolean(),
  ...sincronizable,
});

export const esquemaDispositivo = z.object({
  id,
  nombre: z.string().trim().min(1),
  tipo: z.enum(['caja', 'consulta']),
  prefijo: z
    .string()
    .regex(/^[A-Z]$/)
    .nullable(),
  ultimoFolio: z.number().int().nonnegative(),
  /** Una tablet retirada se desactiva: deja de vender, pero su historial se conserva. */
  activo: z.boolean().default(true),
  ...sincronizable,
});

const conteoPorCategoria = z.record(z.string(), centavos);
const agregadoVentas = z.object({ cantidad: z.number(), importe: centavos });

export const esquemaResumenTurno = z.object({
  ventas: z.number().int().nonnegative(),
  totalVendido: centavos,
  porMetodo: z.object({ efectivo: centavos, tarjeta: centavos, transferencia: centavos }),
  descuentos: centavos,
  cancelaciones: z.object({ cantidad: z.number().int(), importe: centavos }),
  devoluciones: z.object({
    cantidad: z.number().int(),
    importe: centavos,
    efectivo: centavos,
  }),
  entradas: centavos,
  retiros: centavos,
  gastos: z.object({ total: centavos, porCategoria: conteoPorCategoria }),
  fondoInicial: centavos,
  efectivoEsperado: centavos,
  efectivoContado: centavos.nullable(),
  diferencia: centavos.nullable(),
  porProducto: z.array(
    agregadoVentas.extend({ productoId: id, nombre: z.string(), categoriaNombre: z.string() }),
  ),
  porCategoria: z.array(agregadoVentas.extend({ categoriaId: id, nombre: z.string() })),
  porCajero: z.array(agregadoVentas.extend({ usuarioId: id, nombre: z.string(), ventas: z.number().int() })),
});

export const esquemaTurno = z.object({
  id,
  dispositivoId: id,
  dispositivoNombre: z.string(),
  estado: z.enum(['abierto', 'cerrado']),
  abiertoPor: refUsuario,
  abiertoEn: fecha,
  dia,
  fondoInicial: centavosPositivos,
  cerradoPor: refUsuario.optional(),
  cerradoEn: fecha.optional(),
  efectivoContado: centavosPositivos.optional(),
  conteo: z.record(z.string(), z.number().int().nonnegative()).optional(),
  resumen: esquemaResumenTurno.optional(),
  nota: z.string().optional(),
  ...sincronizable,
});

export const esquemaMovimiento = z.object({
  id,
  turnoId: id,
  dispositivoId: id,
  tipo: z.enum(['entrada', 'retiro', 'gasto']),
  categoria: z.string().nullable(),
  concepto: z.string(),
  monto: centavosPositivos,
  usuario: refUsuario,
  fecha,
  dia,
  anulado: z.boolean(),
  anuladoPor: refUsuario.optional(),
  anuladoEn: fecha.optional(),
  ...sincronizable,
});

export const esquemaLineaVenta = z.object({
  id,
  productoId: id,
  nombre: z.string(),
  categoriaId: id,
  categoriaNombre: z.string(),
  /** Precio del tamaño elegido, o el precio base del producto. */
  precioBase: centavosPositivos,
  /** Copia del tamaño elegido (ventas anteriores a los tamaños no lo traen). */
  tamano: z.object({ nombre: z.string(), precio: centavosPositivos }).optional(),
  /** Copia de los ingredientes elegidos y de cómo se cobraron. */
  ingredientes: z
    .object({
      nombres: z.array(z.string()),
      incluidos: z.number().int().nonnegative(),
      /** Ingredientes cobrados como extra. */
      extras: z.number().int().nonnegative(),
      precioExtra: centavosPositivos,
    })
    .optional(),
  modificadores: z.array(z.object({ grupo: z.string(), opcion: z.string(), precioExtra: centavosPositivos })),
  precioUnitario: centavosPositivos,
  cantidad: z.number().int().positive(),
  nota: z.string().nullable(),
  importe: centavosPositivos,
  /** Copia de "Va a cocina" del producto (ventas anteriores no lo traen: cuentan como sí). */
  vaACocina: z.boolean().optional(),
});

export const esquemaDescuento = z.object({
  tipo: z.enum(['porcentaje', 'monto']),
  valor: z.number().nonnegative(),
  importe: centavosPositivos,
  motivo: z.string().nullable(),
  autorizadoPor: refUsuario.nullable(),
});

export const esquemaPago = z.object({
  metodo: metodoPago,
  monto: centavosPositivos,
  recibido: centavosPositivos.optional(),
  referencia: z.string().optional(),
  cuentaId: z.string().optional(),
});

export const ESTADOS_VENTA = ['pagada', 'cancelada', 'devuelta_parcial', 'devuelta'] as const;

export const esquemaCancelacion = z.object({
  motivo: z.string().trim().min(1),
  usuario: refUsuario,
  autorizadoPor: refUsuario.nullable(),
  fecha,
});

export const esquemaVenta = z.object({
  id,
  folio: z.string().regex(/^[A-Z]-\d{6,}$/),
  folioNumero: z.number().int().positive(),
  dispositivoId: id,
  dispositivoNombre: z.string(),
  turnoId: id,
  fecha,
  dia,
  cajero: refUsuario,
  cliente: z.string().nullable(),
  lineas: z.array(esquemaLineaVenta).min(1),
  subtotal: centavosPositivos,
  descuento: esquemaDescuento.nullable(),
  iva: z.object({ tasa: z.number(), incluido: z.boolean(), base: centavos, monto: centavos }),
  total: centavosPositivos,
  pagos: z.array(esquemaPago),
  cambio: centavosPositivos,
  estado: z.enum(ESTADOS_VENTA),
  devuelto: centavosPositivos,
  cancelacion: esquemaCancelacion.nullable(),
  ...sincronizable,
});

export const esquemaDevolucion = z.object({
  id,
  ventaId: id,
  folioVenta: z.string(),
  turnoId: id.nullable(),
  dispositivoId: id,
  lineas: z
    .array(z.object({ lineaId: id, cantidad: z.number().int().positive(), importe: centavosPositivos }))
    .min(1),
  monto: centavosPositivos,
  metodo: metodoPago,
  motivo: z.string().trim().min(1),
  usuario: refUsuario,
  autorizadoPor: refUsuario.nullable(),
  fecha,
  dia,
  ...sincronizable,
});

/** Esquema de cada tabla sincronizable. */
export const ESQUEMAS_TABLA = {
  config: esquemaConfig,
  categorias: esquemaCategoria,
  gruposModificadores: esquemaGrupoModificadores,
  ingredientes: esquemaIngrediente,
  productos: esquemaProducto,
  usuarios: esquemaUsuario,
  dispositivos: esquemaDispositivo,
  turnos: esquemaTurno,
  movimientos: esquemaMovimiento,
  ventas: esquemaVenta,
  devoluciones: esquemaDevolucion,
} as const;

// Sincronización

export const esquemaOperacion = z.object({
  id: z.uuid(),
  tabla: z.enum(TABLAS_SYNC),
  tipo: z.enum(['crear', 'actualizar', 'borrar']),
  registroId: id,
  datos: z.record(z.string(), z.unknown()),
  creadaEn: fecha,
});

export const LIMITE_OPERACIONES_POR_LOTE = 100;

export const esquemaPeticionPush = z.object({
  operaciones: z.array(esquemaOperacion).min(1).max(LIMITE_OPERACIONES_POR_LOTE),
});

export const esquemaResultadoOperacion = z.object({
  id: z.string(),
  resultado: z.enum(['aplicada', 'duplicada', 'rechazada']),
  motivo: z.string().optional(),
});

export const esquemaRespuestaPush = z.object({ resultados: z.array(esquemaResultadoOperacion) });

export const esquemaFilaPull = z.object({
  tabla: z.enum(TABLAS_SYNC),
  rev: z.number().int(),
  borrado: z.boolean(),
  registro: z.record(z.string(), z.unknown()),
});

export const esquemaRespuestaPull = z.object({
  filas: z.array(esquemaFilaPull),
  rev: z.number().int(),
  hayMas: z.boolean(),
});

export const esquemaPeticionAcceso = z.object({
  correo: z.email(),
  contrasena: z.string().min(1),
});

export const esquemaRespuestaAcceso = z.object({
  token: z.string(),
  cuenta: z.object({ id, correo: z.string() }),
});
