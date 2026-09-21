// Menú y configuración para las pruebas del dominio (tomados de seed/menu-demo.json).
import menu from '../../seed/menu-demo.json';
import type { Categoria, ConfigGeneral, GrupoModificadores, Producto } from './tipos';

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
