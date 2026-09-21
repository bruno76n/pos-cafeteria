import { useLiveQuery } from 'dexie-react-hooks';
import { create } from 'zustand';
import { bd } from './bd';

// Estado de la conexión y de la sincronización, para el indicador de la barra superior.

interface EstadoSync {
  /** navigator.onLine combinado con el resultado de la última petición al servidor. */
  enLinea: boolean;
  ultimoError: string | null;
}

export const useEstadoSync = create<EstadoSync>(() => ({
  enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
  ultimoError: null,
}));

export function marcarEstado(cambios: Partial<EstadoSync>) {
  useEstadoSync.setState(cambios);
}

/** Número de ventas con operaciones pendientes de subir. */
async function contarVentasPorSubir(): Promise<number> {
  const ops = await bd.outbox.where('tabla').equals('ventas').toArray();
  return new Set(ops.map((o) => o.registroId)).size;
}

export function useVentasPorSubir(): number {
  return useLiveQuery(contarVentasPorSubir, [], 0);
}
