import { useSyncExternalStore } from 'react';
import { alCambiarBloqueo, baseBloqueada } from '@/datos/bd';

/** true si otra pestaña con la versión anterior impide actualizar la base local. */
export function useBaseBloqueada(): boolean {
  return useSyncExternalStore(
    (avisar) => alCambiarBloqueo(() => avisar()),
    () => baseBloqueada.valor,
    () => false,
  );
}
