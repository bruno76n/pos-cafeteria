import { useState } from 'react';
import { driverNavegador } from './drivers/navegador';
import type { TicketDocumento } from './ticket';

export const MENSAJE_ERROR_IMPRESION =
  'No se pudo imprimir: la impresora no responde. Revisa que esté encendida y vuelve a intentar.';

/** Imprime con la impresora configurada en este dispositivo y expone el error para "Reintentar". */
export function useImpresora() {
  const [error, setError] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  async function imprimir(doc: TicketDocumento): Promise<boolean> {
    setImprimiendo(true);
    setError(null);
    try {
      await driverNavegador.imprimir(doc);
      return true;
    } catch {
      setError(MENSAJE_ERROR_IMPRESION);
      return false;
    } finally {
      setImprimiendo(false);
    }
  }

  return { imprimir, error, imprimiendo };
}
