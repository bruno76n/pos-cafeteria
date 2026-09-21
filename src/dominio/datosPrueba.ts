// Menú y configuración para las pruebas del dominio (tomados de seed/menu-demo.json).
import menu from '../../seed/menu-demo.json';
import type { Categoria, ConfigGeneral, GrupoModificadores, Producto, Venta } from './tipos';

const actualizadoEn = '2026-09-19T12:00:00.000Z';

export const categoriasPrueba: Categoria[] = menu.categorias.map((c) => ({ ...c, actualizadoEn }));
export const gruposPrueba = menu.gruposModificadores.map((g) => ({
  ...g,
  actualizadoEn,
})) as GrupoModificadores[];
export const productosPrueba: Producto[] = menu.productos.map((p) => ({ ...p, imagen: null, actualizadoEn }));

export function productoPrueba(id: string): Producto {
  const p = productosPrueba.find((x) => x.id === id);
  if (!p) throw new Error(`No existe el producto ${id}`);
  return p;
}

export function grupoPrueba(id: string): GrupoModificadores {
  const g = gruposPrueba.find((x) => x.id === id);
  if (!g) throw new Error(`No existe el grupo ${id}`);
  return g;
}

const todos = {
  vender: true,
  aplicarDescuentos: true,
  cancelarVentas: true,
  modificarPrecios: false,
  crearProductos: true,
  abrirCaja: true,
  cerrarCaja: true,
  verReportes: true,
  registrarGastos: true,
};

export const configPrueba: ConfigGeneral = {
  negocio: { ...menu.negocio, logo: null },
  ...(menu.configInicial as Omit<ConfigGeneral, 'negocio' | 'roles'>),
  roles: {
    encargado: todos,
    cajero: {
      ...todos,
      aplicarDescuentos: false,
      cancelarVentas: false,
      crearProductos: false,
      verReportes: false,
    },
  },
};

const ana = { id: 'cajero', nombre: 'Ana' };

/** Venta del caso B: 2 Latte mediano con almendra + 1 Brownie, 10 % de descuento, efectivo $200. */
export function ventaPrueba(cambios: Partial<Venta> = {}): Venta {
  return {
    id: 'venta-b',
    folio: 'A-000123',
    folioNumero: 123,
    dispositivoId: 'caja-1',
    dispositivoNombre: 'Caja 1',
    turnoId: 'turno-1',
    fecha: '2026-09-19T14:42:10.123Z',
    dia: '2026-09-19',
    cajero: ana,
    cliente: 'Luis',
    lineas: [
      {
        id: 'l-latte',
        productoId: 'latte',
        nombre: 'Latte',
        categoriaId: 'cafes',
        categoriaNombre: 'Cafés',
        precioBase: 6500,
        modificadores: [
          { grupo: 'Tamaño', opcion: 'Mediano 16 oz', precioExtra: 1000 },
          { grupo: 'Leche', opcion: 'Almendra', precioExtra: 1000 },
        ],
        precioUnitario: 8500,
        cantidad: 2,
        nota: null,
        importe: 17000,
      },
      {
        id: 'l-brownie',
        productoId: 'brownie',
        nombre: 'Brownie',
        categoriaId: 'postres',
        categoriaNombre: 'Postres',
        precioBase: 4500,
        modificadores: [],
        precioUnitario: 4500,
        cantidad: 1,
        nota: 'calientito',
        importe: 4500,
      },
    ],
    subtotal: 21500,
    descuento: { tipo: 'porcentaje', valor: 10, importe: 2150, motivo: null, autorizadoPor: null },
    iva: { tasa: 0.16, incluido: true, base: 16681, monto: 2669 },
    total: 19350,
    pagos: [{ metodo: 'efectivo', monto: 19350, recibido: 20000 }],
    cambio: 650,
    estado: 'pagada',
    devuelto: 0,
    cancelacion: null,
    actualizadoEn: '2026-09-19T14:42:10.123Z',
    ...cambios,
  };
}
