import { useEffect, useState, useSyncExternalStore } from 'react';
import { leerConfigImpresora, useConfigImpresora } from '@/datos/impresora';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';
import type { ConfigGeneral } from '@/dominio/tipos';
import type { TipoTrabajo, TrabajoImpresion } from './comanda';
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
  /** Qué trabajos no salieron (para reintentar solo esos). */
  fallidos: TipoTrabajo[];
}

/** Pausa entre dos trabajos seguidos para que la impresora no los empalme. */
export const PAUSA_ENTRE_TRABAJOS_MS = 1_000;

const mensajeDe = (e: unknown) => (e instanceof ErrorImpresion ? e.message : MENSAJES_IMPRESORA.noResponde);
const ayudaDe = (e: unknown) => (e instanceof ErrorImpresion ? e.ayuda : undefined);

const NO_SALIO: Record<TipoTrabajo, string> = {
  ticket: MENSAJES_IMPRESORA.ticketCliente,
  comanda: MENSAJES_IMPRESORA.comanda,
  corte: MENSAJES_IMPRESORA.noResponde,
};

/**
 * Qué decir cuando algo falla: si no salió nada, el error de la impresora; si salió uno de dos
 * (o falló una comanda sola), cuál no salió, con el error de la impresora como ayuda.
 */
export function falloDeTrabajos(
  trabajos: TrabajoImpresion[],
  errores: { tipo: TipoTrabajo; error: unknown }[],
): FalloImpresion | null {
  const primero = errores[0];
  if (!primero) return null;
  const fallidos = errores.map((e) => e.tipo);
  const todos = errores.length === trabajos.length;
  if (todos && (trabajos.length > 1 || primero.tipo !== 'comanda')) {
    const ayuda = ayudaDe(primero.error);
    return { mensaje: mensajeDe(primero.error), ...(ayuda ? { ayuda } : {}), fallidos };
  }
  return { mensaje: NO_SALIO[primero.tipo], ayuda: mensajeDe(primero.error), fallidos };
}

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

  /** Manda cada documento como un trabajo aparte; si uno falla, los demás se intentan igual. */
  async function imprimirTrabajos(trabajos: TrabajoImpresion[]): Promise<boolean> {
    setImprimiendo(true);
    setFallo(null);
    const errores: { tipo: TipoTrabajo; error: unknown }[] = [];
    try {
      // Se relee al imprimir: la pantalla pudo cambiarla hace un instante.
      const vigente = await leerConfigImpresora();
      const driver = driverDe(vigente.tipo);
      for (const [i, t] of trabajos.entries()) {
        if (i > 0) await new Promise((resolver) => setTimeout(resolver, PAUSA_ENTRE_TRABAJOS_MS));
        try {
          await driver.imprimir(t.doc, { ...vigente, copias: t.copias ?? vigente.copias });
        } catch (error) {
          errores.push({ tipo: t.tipo, error });
        }
      }
    } catch (error) {
      errores.push(...trabajos.map((t) => ({ tipo: t.tipo, error })));
    }
    setFallo(falloDeTrabajos(trabajos, errores));
    setImprimiendo(false);
    return errores.length === 0;
  }

  const imprimir = (doc: TicketDocumento, tipo: TipoTrabajo = 'ticket') => imprimirTrabajos([{ tipo, doc }]);

  return {
    imprimir,
    imprimirTrabajos,
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
