import { describe, expect, test } from 'vitest';
import {
  esquemaCategoria,
  esquemaConfig,
  esquemaDevolucion,
  esquemaDispositivo,
  esquemaGrupoModificadores,
  esquemaMovimiento,
  esquemaOperacion,
  esquemaPeticionPush,
  esquemaProducto,
  esquemaTurno,
  esquemaUsuario,
  esquemaVenta,
} from './esquemas.js';
import type { Config, Venta } from './tipos.js';

const ahora = '2026-09-19T14:42:10.123Z';
const ana = { id: 'u1', nombre: 'Ana' };
const todos = {
  vender: true,
  aplicarDescuentos: false,
  cancelarVentas: false,
  modificarPrecios: false,
  crearProductos: false,
  abrirCaja: true,
  cerrarCaja: true,
  verReportes: false,
  registrarGastos: true,
};

const config: Config = {
  id: 'general',
  actualizadoEn: ahora,
  datos: {
    negocio: { nombre: 'Cafetería Demo', logo: null, direccion: '', telefono: '', rfc: '' },
    ventas: {
      preciosIncluyenIVA: true,
      tasaIVA: 0.16,
      mostrarDesgloseIVA: true,
      descuentosPermitidos: true,
      descuentoMaximoPorcentaje: 50,
    },
    pagos: { tarjeta: true, transferencia: true, referenciaTransferenciaObligatoria: false, cuentas: [] },
    ticket: {
      ancho: 58,
      mostrarLogo: true,
      mostrarDireccion: true,
      mostrarTelefono: true,
      mostrarRFC: false,
      mostrarCajero: true,
      mensajeFinal: '¡Gracias!',
      imprimirAlCobrar: false,
    },
    gastos: { categorias: ['Hielo'] },
    roles: { encargado: { ...todos, verReportes: true }, cajero: todos },
    zonaHoraria: 'America/Mexico_City',
  },
};

const venta: Venta = {
  id: 'v1',
  folio: 'A-000123',
  folioNumero: 123,
  dispositivoId: 'd1',
  dispositivoNombre: 'Caja 1',
  turnoId: 't1',
  fecha: ahora,
  dia: '2026-09-19',
  cajero: ana,
  cliente: 'Luis',
  lineas: [
    {
      id: 'l1',
      productoId: 'latte',
      nombre: 'Latte',
      categoriaId: 'cafes',
      categoriaNombre: 'Cafés',
      precioBase: 6500,
      modificadores: [{ grupo: 'Tamaño', opcion: 'Mediano', precioExtra: 1000 }],
      precioUnitario: 7500,
      cantidad: 1,
      nota: null,
      importe: 7500,
    },
  ],
  subtotal: 7500,
  descuento: null,
  iva: { tasa: 0.16, incluido: true, base: 6466, monto: 1034 },
  total: 7500,
  pagos: [{ metodo: 'efectivo', monto: 7500, recibido: 10000 }],
  cambio: 2500,
  estado: 'pagada',
  devuelto: 0,
  cancelacion: null,
  actualizadoEn: ahora,
};

const productoValido = {
  id: 'p',
  nombre: 'Latte',
  descripcion: '',
  categoriaId: 'c',
  precio: 6500,
  imagen: null,
  disponible: true,
  orden: 1,
  gruposIds: ['g'],
  actualizadoEn: ahora,
};

describe('compatibilidad con datos anteriores', () => {
  test('un producto sin tamaños (guardado antes) queda con la lista vacía', () => {
    expect(esquemaProducto.parse(productoValido).tamanos).toEqual([]);
  });
  test('tamaños sin incluidos y producto sin armado toman sus valores por defecto', () => {
    const p = esquemaProducto.parse({
      ...productoValido,
      tamanos: [{ id: 't', nombre: 'Chica', precio: 5500 }],
    });
    expect(p.tamanos[0]?.incluidos).toBe(0);
    expect(p.armado).toBeNull();
  });
  test('una venta anterior a los tamaños sigue siendo válida', () => {
    expect(esquemaVenta.safeParse(venta).success).toBe(true);
  });
  test('una línea nueva guarda la copia del tamaño', () => {
    const [linea] = venta.lineas;
    const conTamano = {
      ...linea!,
      precioBase: 7500,
      tamano: { nombre: 'Mediano', precio: 7500 },
      modificadores: [],
    };
    expect(esquemaVenta.parse({ ...venta, lineas: [conTamano] }).lineas[0]?.tamano).toEqual({
      nombre: 'Mediano',
      precio: 7500,
    });
  });
});

describe('esquemas válidos', () => {
  test.each([
    ['config', esquemaConfig, config],
    ['venta', esquemaVenta, venta],
    [
      'categoría',
      esquemaCategoria,
      { id: 'c', nombre: 'Cafés', color: '#6B4226', orden: 1, activa: true, actualizadoEn: ahora },
    ],
    [
      'grupo',
      esquemaGrupoModificadores,
      {
        id: 'g',
        nombre: 'Tamaño',
        tipo: 'unico',
        obligatorio: true,
        min: 1,
        max: 1,
        orden: 1,
        opciones: [{ id: 'o', nombre: 'Chico', precioExtra: 0, porDefecto: true, disponible: true }],
        actualizadoEn: ahora,
      },
    ],
    [
      'producto',
      esquemaProducto,
      {
        id: 'p',
        nombre: 'Latte',
        descripcion: '',
        categoriaId: 'c',
        precio: 6500,
        imagen: null,
        disponible: true,
        orden: 1,
        gruposIds: ['g'],
        actualizadoEn: ahora,
      },
    ],
    [
      'usuario',
      esquemaUsuario,
      {
        id: 'u',
        nombre: 'Ana',
        rol: 'cajero',
        pinHash: 'a'.repeat(64),
        pinSal: 'b'.repeat(32),
        activo: true,
        actualizadoEn: ahora,
      },
    ],
    [
      'dispositivo',
      esquemaDispositivo,
      { id: 'd', nombre: 'Caja 1', tipo: 'caja', prefijo: 'A', ultimoFolio: 0, actualizadoEn: ahora },
    ],
    [
      'turno',
      esquemaTurno,
      {
        id: 't',
        dispositivoId: 'd',
        dispositivoNombre: 'Caja 1',
        estado: 'abierto',
        abiertoPor: ana,
        abiertoEn: ahora,
        dia: '2026-09-19',
        fondoInicial: 50000,
        actualizadoEn: ahora,
      },
    ],
    [
      'movimiento',
      esquemaMovimiento,
      {
        id: 'm',
        turnoId: 't',
        dispositivoId: 'd',
        tipo: 'gasto',
        categoria: 'Hielo',
        concepto: 'Bolsa de hielo',
        monto: 8000,
        usuario: ana,
        fecha: ahora,
        dia: '2026-09-19',
        anulado: false,
        actualizadoEn: ahora,
      },
    ],
    [
      'devolución',
      esquemaDevolucion,
      {
        id: 'r',
        ventaId: 'v1',
        folioVenta: 'A-000123',
        turnoId: 't',
        dispositivoId: 'd',
        lineas: [{ lineaId: 'l1', cantidad: 1, importe: 4050 }],
        monto: 4050,
        metodo: 'efectivo',
        motivo: 'Frío',
        usuario: ana,
        autorizadoPor: null,
        fecha: ahora,
        dia: '2026-09-19',
        actualizadoEn: ahora,
      },
    ],
  ] as const)('%s', (_nombre, esquema, doc) => {
    expect(esquema.safeParse(doc).success).toBe(true);
  });
});

describe('esquemas inválidos', () => {
  test('dinero con decimales', () => {
    expect(esquemaVenta.safeParse({ ...venta, total: 75.5 }).success).toBe(false);
  });
  test('venta sin líneas', () => {
    expect(esquemaVenta.safeParse({ ...venta, lineas: [] }).success).toBe(false);
  });
  test('folio sin prefijo', () => {
    expect(esquemaVenta.safeParse({ ...venta, folio: '000123' }).success).toBe(false);
  });
  test('estado desconocido', () => {
    expect(esquemaVenta.safeParse({ ...venta, estado: 'borrada' }).success).toBe(false);
  });
  test('fecha sin zona', () => {
    expect(esquemaVenta.safeParse({ ...venta, fecha: '2026-09-19 08:00' }).success).toBe(false);
  });
  test('prefijo de dos letras', () => {
    expect(
      esquemaDispositivo.safeParse({
        id: 'd',
        nombre: 'Caja',
        tipo: 'caja',
        prefijo: 'AB',
        ultimoFolio: 0,
        actualizadoEn: ahora,
      }).success,
    ).toBe(false);
  });
  test('grupo con mínimo mayor que máximo', () => {
    expect(
      esquemaGrupoModificadores.safeParse({
        id: 'g',
        nombre: 'Jarabes',
        tipo: 'multiple',
        obligatorio: false,
        min: 3,
        max: 2,
        orden: 1,
        opciones: [],
        actualizadoEn: ahora,
      }).success,
    ).toBe(false);
  });
  test('precio negativo', () => {
    expect(
      esquemaProducto.safeParse({
        id: 'p',
        nombre: 'X',
        descripcion: '',
        categoriaId: 'c',
        precio: -1,
        imagen: null,
        disponible: true,
        orden: 1,
        gruposIds: [],
        actualizadoEn: ahora,
      }).success,
    ).toBe(false);
  });
  test('armado con mínimo mayor que el máximo', () => {
    const armado = { incluidos: 2, precioExtra: 500, min: 3, max: 2, permitidos: null };
    expect(esquemaProducto.safeParse({ ...productoValido, armado }).error?.issues[0]?.message).toBe(
      'El mínimo de ingredientes no puede ser mayor que el máximo',
    );
    expect(esquemaProducto.safeParse({ ...productoValido, armado: { ...armado, max: null } }).success).toBe(
      true,
    );
  });
  test('dos tamaños con el mismo nombre', () => {
    const r = esquemaProducto.safeParse({
      ...productoValido,
      tamanos: [
        { id: 't1', nombre: 'Grande', precio: 7500 },
        { id: 't2', nombre: 'grande', precio: 8500 },
      ],
    });
    expect(r.error?.issues[0]?.message).toBe('Hay dos tamaños con el mismo nombre');
  });
  test('config con permiso faltante', () => {
    const { vender: _, ...sinVender } = todos;
    expect(
      esquemaConfig.safeParse({
        ...config,
        datos: { ...config.datos, roles: { encargado: todos, cajero: sinVender } },
      }).success,
    ).toBe(false);
  });
});

describe('operaciones de sincronización', () => {
  const op = {
    id: '0b6d1b8e-8a55-4b3e-9d0e-3f1c2a4b5c6d',
    tabla: 'ventas',
    tipo: 'crear',
    registroId: 'v1',
    datos: venta,
    creadaEn: ahora,
  };
  test('operación válida', () => {
    expect(esquemaOperacion.safeParse(op).success).toBe(true);
  });
  test('tabla desconocida', () => {
    expect(esquemaOperacion.safeParse({ ...op, tabla: 'cuentas' }).success).toBe(false);
  });
  test('lote de más de 100 operaciones', () => {
    expect(esquemaPeticionPush.safeParse({ operaciones: Array(101).fill(op) }).success).toBe(false);
    expect(esquemaPeticionPush.safeParse({ operaciones: Array(100).fill(op) }).success).toBe(true);
  });
});
