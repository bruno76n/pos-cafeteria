import { SECCIONES, type ContextoSeccion } from '@/secciones';
import { useDispositivoActual } from './dispositivo';
import { useUsuarioActivo } from './sesion';

/** Secciones que el usuario activo puede ver en este dispositivo. */
export function useSeccionesPermitidas() {
  const { puede, esAdmin } = useUsuarioActivo();
  const dispositivo = useDispositivoActual();
  const contexto: ContextoSeccion = { puede, esAdmin, esCaja: dispositivo?.tipo === 'caja' };
  return SECCIONES.filter((s) => s.visible(contexto));
}
