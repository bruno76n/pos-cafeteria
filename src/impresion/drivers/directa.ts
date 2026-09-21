import { anchoLogo, prepararLogo, ticketAEscPos } from '../escpos';
import type { TicketDocumento } from '../ticket';
import { ErrorImpresion, type DriverImpresora } from './tipos';

/** Datos que se guardan para reconectar y para codificar en el idioma de la impresora. */
export interface ConexionGuardada {
  language: string;
  codepageMapping: string;
  serialNumber?: string;
  vendorId?: number;
  productId?: number;
  id?: string;
  nombre: string;
}

const ESPERA_CONEXION_MS = 3_000;

/**
 * Driver de impresión directa (ESC/POS) sobre una librería de @point-of-sale.
 * USB y Bluetooth comparten todo menos la librería y cómo se detecta el soporte.
 */
export function crearDriverDirecto(opciones: {
  tipo: 'usb' | 'bluetooth';
  nombre: string;
  soportado: () => boolean;
  cargar: () => Promise<{ new (): ImpresoraPOS }>;
}): DriverImpresora {
  let impresora: ImpresoraPOS | null = null;
  let conexion: ConexionGuardada | null = null;
  let esperando: ((c: ConexionGuardada | null) => void) | null = null;

  async function instancia() {
    if (!impresora) {
      const Clase = await opciones.cargar();
      impresora = new Clase();
      impresora.addEventListener('connected', (c) => {
        conexion = {
          language: c.language,
          codepageMapping: c.codepageMapping,
          serialNumber: c.serialNumber,
          vendorId: c.vendorId,
          productId: c.productId,
          id: c.id,
          nombre: [c.manufacturerName, c.productName ?? c.name].filter(Boolean).join(' ') || 'Impresora',
        };
        esperando?.(conexion);
      });
      impresora.addEventListener('disconnected', () => {
        conexion = null;
      });
    }
    return impresora;
  }

  /** Ejecuta connect/reconnect y espera el evento `connected` (la librería no lanza errores). */
  async function conectarCon(accion: (i: ImpresoraPOS) => Promise<void>) {
    const i = await instancia();
    const conectada = new Promise<ConexionGuardada | null>((resolver) => {
      esperando = resolver;
      setTimeout(() => resolver(null), ESPERA_CONEXION_MS);
    });
    await accion(i);
    const resultado = await conectada;
    esperando = null;
    return resultado;
  }

  return {
    tipo: opciones.tipo,
    nombre: opciones.nombre,
    soportado: opciones.soportado,
    estado: () => (conexion ? 'conectada' : 'desconectada'),
    async conectar() {
      const c = await conectarCon((i) => i.connect());
      if (!c) throw new ErrorImpresion('No se conectó ninguna impresora.');
      return c;
    },
    async reconectar(datos) {
      if (conexion) return true;
      if (!datos) return false;
      return Boolean(await conectarCon((i) => i.reconnect(datos)));
    },
    async imprimir(doc: TicketDocumento) {
      if (!impresora || !conexion) throw new ErrorImpresion('La impresora no está conectada.');
      const lineaLogo = doc.lineas.find((l) => l.tipo === 'logo');
      const logo = lineaLogo
        ? await prepararLogo(lineaLogo.dataUrl, anchoLogo(doc.columnas)).catch(() => undefined)
        : undefined;
      await impresora.print(
        ticketAEscPos(doc, { logo, language: conexion.language, codepageMapping: conexion.codepageMapping }),
      );
    },
  };
}
