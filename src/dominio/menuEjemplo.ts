// Menú y configuración de ejemplo (seed/menu-demo.json). Lo usan el seed y "Cargar menú de ejemplo".
import menu from '../../seed/menu-demo.json';
import { ROLES_POR_DEFECTO } from './permisos';
import type { Categoria, ConfigGeneral, GrupoModificadores, Ingrediente, Producto } from './tipos';

export interface MenuEjemplo {
  categorias: Categoria[];
  gruposModificadores: GrupoModificadores[];
  ingredientes: Ingrediente[];
  productos: Producto[];
}

export function menuDeEjemplo(actualizadoEn: string): MenuEjemplo {
  return {
    categorias: menu.categorias.map((c) => ({ ...c, actualizadoEn })),
    gruposModificadores: menu.gruposModificadores.map((g) => ({
      ...g,
      tipo: g.tipo as GrupoModificadores['tipo'],
      actualizadoEn,
    })),
    ingredientes: menu.ingredientes.map((i) => ({ ...i, actualizadoEn })),
    productos: menu.productos.map((p) => ({ ...p, imagen: null, actualizadoEn })),
  };
}

/** Configuración inicial: negocio y opciones del ejemplo más los roles por defecto. */
export function configInicial(nombreNegocio?: string): ConfigGeneral {
  const c = menu.configInicial;
  return {
    negocio: { ...menu.negocio, nombre: nombreNegocio?.trim() || menu.negocio.nombre, logo: null },
    ventas: c.ventas,
    pagos: c.pagos,
    ticket: { ...c.ticket, ancho: c.ticket.ancho === 80 ? 80 : 58 },
    gastos: c.gastos,
    roles: ROLES_POR_DEFECTO,
    zonaHoraria: c.zonaHoraria,
  };
}

/** Configuración de un negocio nuevo desde el asistente: sin datos de contacto del ejemplo. */
export function configNueva(nombreNegocio: string): ConfigGeneral {
  const base = configInicial(nombreNegocio);
  return {
    ...base,
    negocio: { nombre: nombreNegocio.trim(), logo: null, direccion: '', telefono: '', rfc: '' },
    pagos: { ...base.pagos, cuentas: [] },
  };
}

export const usuariosDemo = menu.usuariosDemo as {
  id: string;
  nombre: string;
  rol: 'admin' | 'encargado' | 'cajero';
  pin: string;
}[];
