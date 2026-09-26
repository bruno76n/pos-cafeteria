import { useLiveQuery } from 'dexie-react-hooks';
import { normalizarConfigImpresora, type ConfigImpresora } from '@/impresion/configImpresora';
import { bd, guardarMeta, leerMeta } from './bd';

// Configuración de la impresora de este dispositivo (local, no se sincroniza).

export async function leerConfigImpresora(): Promise<ConfigImpresora> {
  return normalizarConfigImpresora(await leerMeta('impresora'));
}

/** `undefined` mientras carga. */
export function useConfigImpresora(): ConfigImpresora | undefined {
  return useLiveQuery(async () => normalizarConfigImpresora((await bd.meta.get('impresora'))?.valor));
}

/** Guarda solo lo que cambia (lee y escribe en la misma transacción). */
export async function cambiarConfigImpresora(cambios: Partial<ConfigImpresora>): Promise<ConfigImpresora> {
  return bd.transaction('rw', bd.meta, async () => {
    const nueva = normalizarConfigImpresora({ ...(await leerConfigImpresora()), ...cambios });
    await guardarMeta('impresora', nueva);
    return nueva;
  });
}
