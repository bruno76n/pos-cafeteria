import { useState } from 'react';
import { useMeta } from '@/datos/consultas';
import { formatearFechaHora } from '@/dominio/fechas';
import type { ConfigGeneral } from '@/dominio/tipos';
import { DRIVERS } from './drivers';
import { columnasDeAncho, type TicketDocumento } from './ticket';

export const MENSAJE_ERROR_IMPRESION =
  'No se pudo imprimir: la impresora no responde. Revisa que esté encendida y vuelve a intentar.';

/** Ticket de "Imprimir prueba" (revisa acentos, ancho y corte). */
export function ticketDePrueba(config: ConfigGeneral): TicketDocumento {
  return {
    columnas: columnasDeAncho(config.ticket.ancho),
    lineas: [
      {
        tipo: 'texto',
        texto: config.negocio.nombre.toLocaleUpperCase('es-MX'),
        alineacion: 'centro',
        negrita: true,
      },
      { tipo: 'texto', texto: 'Prueba de impresión', alineacion: 'centro', doble: true },
      { tipo: 'separador' },
      { tipo: 'texto', texto: formatearFechaHora(new Date(), config.zonaHoraria) },
      { tipo: 'texto', texto: 'Café, Piña, Año, ¡Gracias!' },
      { tipo: 'columnas', izquierda: 'Izquierda', derecha: 'Derecha' },
      { tipo: 'separador' },
      { tipo: 'espacio' },
      { tipo: 'corte' },
    ],
  };
}

/** Imprime con la impresora configurada en este dispositivo y expone el error para "Reintentar". */
export function useImpresora() {
  const impresora = useMeta('impresora');
  const [error, setError] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  async function imprimir(doc: TicketDocumento): Promise<boolean> {
    setImprimiendo(true);
    setError(null);
    try {
      const elegido = impresora ? DRIVERS[impresora.tipo] : DRIVERS.navegador;
      const driver = elegido.soportado() ? elegido : DRIVERS.navegador;
      if (driver.estado() !== 'conectada' && !(await driver.reconectar(impresora?.reconexion ?? null))) {
        throw new Error('desconectada');
      }
      await driver.imprimir(doc);
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
