import type { TicketDocumento } from '../ticket';

export type TipoImpresora = 'navegador' | 'usb' | 'bluetooth';

/** Misma interfaz para todas las impresoras. */
export interface DriverImpresora {
  tipo: TipoImpresora;
  nombre: string;
  /** ¿Este navegador/dispositivo puede usar esta conexión? */
  soportado(): boolean;
  /** Elige la impresora (debe llamarse desde un toque). Regresa los datos para reconectar. */
  conectar(): Promise<unknown>;
  /** Vuelve a conectar sin preguntar, con los datos guardados. */
  reconectar(datos: unknown): Promise<boolean>;
  imprimir(doc: TicketDocumento): Promise<void>;
  estado(): 'conectada' | 'desconectada';
}

export class ErrorImpresion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorImpresion';
  }
}
