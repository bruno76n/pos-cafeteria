import { PERMISOS } from './esquemas';
import type { Permiso, PermisosPorRol, Rol, Usuario } from './tipos';

export const NOMBRE_PERMISO: Record<Permiso, string> = {
  vender: 'Vender',
  aplicarDescuentos: 'Aplicar descuentos',
  cancelarVentas: 'Cancelar ventas y hacer devoluciones',
  modificarPrecios: 'Modificar precios',
  crearProductos: 'Crear y editar productos, categorías y modificadores',
  abrirCaja: 'Abrir caja',
  cerrarCaja: 'Cerrar caja',
  verReportes: 'Ver reportes',
  registrarGastos: 'Registrar gastos y movimientos de caja',
};

/** Para mensajes: "Tu usuario no puede cancelar ventas." */
export const ACCION_PERMISO: Record<Permiso, string> = {
  vender: 'vender',
  aplicarDescuentos: 'aplicar descuentos',
  cancelarVentas: 'cancelar ventas ni hacer devoluciones',
  modificarPrecios: 'modificar precios',
  crearProductos: 'editar el menú',
  abrirCaja: 'abrir caja',
  cerrarCaja: 'cerrar caja',
  verReportes: 'ver reportes',
  registrarGastos: 'registrar movimientos de caja',
};

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
};

export { PERMISOS };

const conPermisos = (permitidos: Permiso[]) =>
  Object.fromEntries(PERMISOS.map((p) => [p, permitidos.includes(p)])) as Record<Permiso, boolean>;

/** Valores por defecto (docs/01-especificacion.md §3). */
export const ROLES_POR_DEFECTO: PermisosPorRol = {
  encargado: conPermisos([
    'vender',
    'aplicarDescuentos',
    'cancelarVentas',
    'crearProductos',
    'abrirCaja',
    'cerrarCaja',
    'verReportes',
    'registrarGastos',
  ]),
  cajero: conPermisos(['vender', 'abrirCaja', 'cerrarCaja', 'registrarGastos']),
};

/** El Administrador puede todo; los demás según la matriz de roles de la configuración. */
export function puede(
  usuario: Pick<Usuario, 'rol' | 'activo'> | null | undefined,
  permiso: Permiso,
  roles: PermisosPorRol,
): boolean {
  if (!usuario?.activo) return false;
  if (usuario.rol === 'admin') return true;
  return roles[usuario.rol][permiso];
}

/** Usuarios y Configuración: solo Administrador. */
export const esAdmin = (usuario: Pick<Usuario, 'rol' | 'activo'> | null | undefined) =>
  usuario?.rol === 'admin' && usuario.activo;
