import { useDispositivo, useMeta } from '@/datos/consultas';

/** Dispositivo configurado en esta tablet. undefined mientras carga; null si no está configurado. */
export function useDispositivoActual() {
  const id = useMeta('dispositivoId');
  const dispositivo = useDispositivo(id);
  if (id === undefined || (id && dispositivo === undefined)) return undefined;
  return dispositivo ?? null;
}
