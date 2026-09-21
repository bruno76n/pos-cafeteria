import { create } from 'zustand';
import type { Permiso, RefUsuario } from '@/dominio/tipos';
import { refUsuario, useUsuarioActivo } from './sesion';

// "Pedir autorización": otro usuario con el permiso escribe su PIN (lo muestra DialogoAutorizacion).

interface Solicitud {
  permiso: Permiso;
  resolver: (autorizo: RefUsuario | null) => void;
}

export const useSolicitudAutorizacion = create<{ solicitud: Solicitud | null }>(() => ({ solicitud: null }));

/** Abre el diálogo de PIN. Regresa quién autorizó, o null si se canceló. */
export function pedirAutorizacion(permiso: Permiso): Promise<RefUsuario | null> {
  useSolicitudAutorizacion.getState().solicitud?.resolver(null);
  return new Promise((resolver) => {
    useSolicitudAutorizacion.setState({
      solicitud: {
        permiso,
        resolver: (autorizo) => {
          useSolicitudAutorizacion.setState({ solicitud: null });
          resolver(autorizo);
        },
      },
    });
  });
}

export interface Permitido {
  /** Usuario que hace la acción (el activo). */
  usuario: RefUsuario;
  /** Quién autorizó, si el usuario activo no tenía el permiso. */
  autorizadoPor: RefUsuario | null;
}

/**
 * Para acciones sensibles: si el usuario activo tiene el permiso, sigue; si no, pide autorización.
 * Regresa null si se canceló.
 */
export function useAutorizar() {
  const { usuario, puede } = useUsuarioActivo();
  return async (permiso: Permiso): Promise<Permitido | null> => {
    if (!usuario) return null;
    if (puede(permiso)) return { usuario: refUsuario(usuario), autorizadoPor: null };
    const autorizo = await pedirAutorizacion(permiso);
    return autorizo ? { usuario: refUsuario(usuario), autorizadoPor: autorizo } : null;
  };
}
