import { create } from 'zustand';
import { useConfig, useUsuarios } from '@/datos/consultas';
import { esAdmin, puede, ROLES_POR_DEFECTO } from '@/dominio/permisos';
import type { Permiso, RefUsuario, Usuario } from '@/dominio/tipos';

// Sesión del usuario (en memoria): recargar la app vuelve a pedir PIN.

interface EstadoSesion {
  usuarioId: string | null;
  ultimaActividad: number;
  entrar: (usuarioId: string) => void;
  bloquear: () => void;
  registrarActividad: () => void;
}

export const useSesion = create<EstadoSesion>((set) => ({
  usuarioId: null,
  ultimaActividad: Date.now(),
  entrar: (usuarioId) => set({ usuarioId, ultimaActividad: Date.now() }),
  bloquear: () => set({ usuarioId: null }),
  registrarActividad: () => set({ ultimaActividad: Date.now() }),
}));

export const refUsuario = (u: Pick<Usuario, 'id' | 'nombre'>): RefUsuario => ({ id: u.id, nombre: u.nombre });

/**
 * Usuario activo (leído en vivo: si lo desactivan, la sesión se bloquea) y sus permisos.
 * `usuario` es undefined mientras carga.
 */
export function useUsuarioActivo() {
  const usuarioId = useSesion((s) => s.usuarioId);
  const usuarios = useUsuarios();
  const config = useConfig();
  const roles = config?.roles ?? ROLES_POR_DEFECTO;
  const usuario =
    usuarios === undefined ? undefined : (usuarios.find((u) => u.id === usuarioId && u.activo) ?? null);
  return {
    usuario,
    puede: (permiso: Permiso) => puede(usuario, permiso, roles),
    esAdmin: esAdmin(usuario),
  };
}
