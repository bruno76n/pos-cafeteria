import { PERMISOS } from './esquemas.js';
import { buscarUsuarioPorPin } from './pin.js';
import type { Permiso, PermisosPorRol, Rol, Usuario } from './tipos.js';

export const NOMBRE_PERMISO: Record<Permiso, string> = {
  vender: 'Vender',
  aplicarDescuentos: 'Aplicar descuentos',
  cancelarVentas: 'Cancelar ventas y hacer devoluciones',
  modificarPrecios: 'Modificar precios',
  crearProductos: 'Crear y editar productos, categorías, ingredientes y modificadores',
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

export type ResultadoAutorizacion =
  | { ok: true; usuario: Pick<Usuario, 'id' | 'nombre'> }
  | { ok: false; motivo: 'pin' | 'sin-permiso'; mensaje: string };

/** Autorización con el PIN de otro usuario: debe estar activo y tener el permiso. */
export async function autorizarConPin<U extends Usuario>(
  usuarios: U[],
  roles: PermisosPorRol,
  permiso: Permiso,
  pin: string,
): Promise<ResultadoAutorizacion> {
  const usuario = await buscarUsuarioPorPin(usuarios, pin);
  if (!usuario) return { ok: false, motivo: 'pin', mensaje: 'PIN incorrecto.' };
  if (!puede(usuario, permiso, roles)) {
    return {
      ok: false,
      motivo: 'sin-permiso',
      mensaje: `${usuario.nombre} tampoco puede ${ACCION_PERMISO[permiso]}.`,
    };
  }
  return { ok: true, usuario: { id: usuario.id, nombre: usuario.nombre } };
}

/**
 * Error si el cambio deja al negocio sin Administrador activo (no se puede desactivar ni cambiar
 * de rol al último), o null si se puede guardar.
 */
export function validarUltimoAdmin(
  usuarios: Pick<Usuario, 'id' | 'rol' | 'activo'>[],
  editado: Pick<Usuario, 'id' | 'rol' | 'activo'>,
): string | null {
  const antes = usuarios.find((u) => u.id === editado.id);
  const eraAdminActivo = antes?.rol === 'admin' && antes.activo;
  const siguePudiendo = editado.rol === 'admin' && editado.activo;
  if (!eraAdminActivo || siguePudiendo) return null;
  const otros = usuarios.filter((u) => u.id !== editado.id && u.rol === 'admin' && u.activo);
  return otros.length === 0
    ? 'Es el último Administrador activo: no se puede desactivar ni cambiar de rol.'
    : null;
}
