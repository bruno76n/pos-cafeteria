import { useEffect, useState, useSyncExternalStore } from 'react';
import { leerConfigImpresora, useConfigImpresora } from '@/datos/impresora';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';
import type { ConfigGeneral } from '@/dominio/tipos';
import { CONFIG_IMPRESORA_POR_DEFECTO, columnasDeImpresora } from './configImpresora';
import { DRIVERS, driverDe, ErrorImpresion, MENSAJES_IMPRESORA, type DriverImpresora } from './drivers';
import type { TicketDocumento } from './ticket';

/** Ticket de "Imprimir prueba": acentos, ñ, signo de pesos, totales, ancho y logo si está activado. */
export function ticketDePrueba(config: ConfigGeneral, columnas: 32 | 48): TicketDocumento {
  const { negocio, ticket } = config;
  return {
    columnas,
    lineas: [
      ...(ticket.mostrarLogo && negocio.logo ? [{ tipo: 'logo' as const, dataUrl: negocio.logo }] : []),
      {
        tipo: 'texto',
        texto: negocio.nombre.toLocaleUpperCase('es-MX'),
        alineacion: 'centro',
        negrita: true,
      },
      { tipo: 'texto', texto: 'Prueba de impresión', alineacion: 'centro', doble: true },
      { tipo: 'separador' },
      { tipo: 'texto', texto: formatearFechaHora(new Date(), config.zonaHoraria) },
      { tipo: 'texto', texto: 'Café, Piña, Año, ¡Gracias!' },
      { tipo: 'columnas', izquierda: '1 Café de olla', derecha: formatearDinero(3500) },
      { tipo: 'separador' },
      { tipo: 'columnas', izquierda: 'TOTAL', derecha: formatearDinero(123450), negrita: true },
      { tipo: 'texto', texto: `${columnas} columnas`, alineacion: 'derecha' },
      { tipo: 'espacio' },
    ],
  };
}

export interface FalloImpresion {
  mensaje: string;
  ayuda?: string;
}

const falloDe = (e: unknown): FalloImpresion =>
  e instanceof ErrorImpresion
    ? { mensaje: e.message, ...(e.ayuda ? { ayuda: e.ayuda } : {}) }
    : { mensaje: MENSAJES_IMPRESORA.noResponde };

/** Estado de conexión del driver, en vivo. */
export function useEstadoImpresora(driver: DriverImpresora) {
  return useSyncExternalStore(driver.suscribir, driver.estado);
}

/**
 * Imprime con la impresora configurada en este dispositivo y expone el error para "Reintentar".
 * `columnas` es el ancho del papel con el que se arman los tickets.
 */
export function useImpresora() {
  const config = useConfigImpresora();
  const [fallo, setFallo] = useState<FalloImpresion | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const actual = config ?? CONFIG_IMPRESORA_POR_DEFECTO;

  async function imprimir(doc: TicketDocumento): Promise<boolean> {
    setImprimiendo(true);
    setFallo(null);
    try {
      // Se relee al imprimir: la pantalla pudo cambiarla hace un instante.
      const vigente = await leerConfigImpresora();
      await driverDe(vigente.tipo).imprimir(doc, vigente);
      return true;
    } catch (e) {
      setFallo(falloDe(e));
      return false;
    } finally {
      setImprimiendo(false);
    }
  }

  return {
    imprimir,
    error: fallo?.mensaje ?? null,
    fallo,
    imprimiendo,
    columnas: columnasDeImpresora(actual),
    imprimirAlCobrar: actual.imprimirAlCobrar,
  };
}

/** Al abrir la app, reconecta la impresora Bluetooth guardada (sin preguntar). */
export function useReconexionImpresora() {
  useEffect(() => {
    void leerConfigImpresora().then((config) => {
      if (config.tipo === 'bluetooth' && config.dispositivo && DRIVERS.bluetooth.soportado()) {
        void DRIVERS.bluetooth.reconectar(config);
      }
    });
  }, []);
}
