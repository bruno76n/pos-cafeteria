import { guardarMeta } from './bd';

async function pedirPersistencia(): Promise<boolean> {
  const almacen = typeof navigator === 'undefined' ? undefined : navigator.storage;
  try {
    if (await almacen?.persisted?.()) return true;
    return (await almacen?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Pide al navegador no borrar los datos locales (ventas por subir) y guarda el resultado. */
export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  const persistente = await pedirPersistencia();
  await guardarMeta('almacenamientoPersistente', persistente);
  return persistente;
}
