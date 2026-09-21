import { useConfig } from '@/datos/consultas';
import { guardar } from '@/datos/escrituras';
import type { ConfigGeneral } from '@/dominio/tipos';

/** Configuración general y cómo guardarla (registro completo; gana el último cambio). */
export function useConfigEditable() {
  const config = useConfig();
  return {
    config,
    guardarConfig: (datos: ConfigGeneral) => guardar('config', { id: 'general', datos }),
  };
}
