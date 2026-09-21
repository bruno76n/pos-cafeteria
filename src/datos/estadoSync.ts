import { useLiveQuery } from 'dexie-react-hooks';
import { create } from 'zustand';
import { bd } from './bd';

// Estado de la conexión y de la sincronización, para el indicador de la barra superior.

export interface EstadoSync {
  /** navigator.onLine combinado con el resultado de la última petición al servidor. */
  enLinea: boolean;
  sincronizando: boolean;
  ultimoExito: string | null;
  ultimoError: string | null;
  /** Milisegundos de espera antes del siguiente reintento tras un error de red. */
  esperaMs: number;
}

export const useEstadoSync = create<EstadoSync>(() => ({
  enLinea: typeof navigator === 'undefined' ? true : navigator.onLine,
  sincronizando: false,
  ultimoExito: null,
  ultimoError: null,
  esperaMs: 0,
}));

export function marcarEstado(cambios: Partial<EstadoSync>) {
  useEstadoSync.setState(cambios);
}

/** Número de ventas con operaciones pendientes de subir. */
export async function contarVentasPorSubir(): Promise<number> {
  const ops = await bd.outbox.where('tabla').equals('ventas').toArray();
  return new Set(ops.map((o) => o.registroId)).size;
}

export function useVentasPorSubir(): number {
  return useLiveQuery(contarVentasPorSubir, [], 0);
}
