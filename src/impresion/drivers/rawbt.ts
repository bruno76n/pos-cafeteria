import { bytesDeTicket } from '../escpos';
import type { ConfigImpresora } from '../configImpresora';
import type { TicketDocumento } from '../ticket';
import { ErrorImpresion, MENSAJES_IMPRESORA as M, sinConexion, type DriverImpresora } from './tipos';

// RawBT (app de Android): recibe los bytes ESC/POS por un intent y los manda a la impresora
// Bluetooth clásico emparejada en la tablet. Respaldo para las impresoras que Web Bluetooth no ve.

/** Si en este tiempo la página no pierde el foco, RawBT no se abrió (no está instalada). */
export const ESPERA_RAWBT_MS = 2_500;

export function base64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

/**
 * Intent de Chrome para Android con el esquema de RawBT. Sin `package`: si la app no está,
 * Chrome no hace nada (con `package` abriría la Play Store) y lo detectamos por el foco.
 */
export const urlRawBT = (bytes: Uint8Array) => `intent:base64,${base64(bytes)}#Intent;scheme=rawbt;end;`;

interface Entorno {
  soportado: () => boolean;
  /** Abre el intent y resuelve `true` si la app respondió (la página perdió el foco). */
  abrir: (url: string) => Promise<boolean>;
  bytes: (doc: TicketDocumento, config: ConfigImpresora) => Promise<Uint8Array>;
}

function abrirEnNavegador(url: string): Promise<boolean> {
  return new Promise((resolver) => {
    let listo = false;
    const terminar = (abrio: boolean) => {
      if (listo) return;
      listo = true;
      window.removeEventListener('blur', alSalir);
      document.removeEventListener('visibilitychange', alSalir);
      resolver(abrio);
    };
    const alSalir = () => terminar(true);
    window.addEventListener('blur', alSalir);
    document.addEventListener('visibilitychange', alSalir);
    setTimeout(() => terminar(false), ESPERA_RAWBT_MS);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.click();
  });
}

const entornoNavegador: Entorno = {
  soportado: () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent),
  abrir: abrirEnNavegador,
  bytes: bytesDeTicket,
};

export function crearDriverRawBT(entorno: Entorno = entornoNavegador): DriverImpresora {
  return {
    ...sinConexion,
    tipo: 'rawbt',
    nombre: 'RawBT',
    soportado: entorno.soportado,
    async imprimir(doc, config) {
      const abrio = await entorno.abrir(urlRawBT(await entorno.bytes(doc, config)));
      if (!abrio) throw new ErrorImpresion(M.rawbt);
    },
  };
}

export const driverRawBT = crearDriverRawBT();
