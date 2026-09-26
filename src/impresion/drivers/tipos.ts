import type { ConfigImpresora, DispositivoImpresora, TipoImpresora } from '../configImpresora';
import type { TicketDocumento } from '../ticket';

export type { TipoImpresora } from '../configImpresora';

export type EstadoConexion = 'conectada' | 'desconectada' | 'buscando';

/** Misma interfaz para todas las conexiones (Bluetooth, RawBT y diálogo del sistema). */
export interface DriverImpresora {
  tipo: TipoImpresora;
  nombre: string;
  /** ¿Este navegador/dispositivo puede usar esta conexión? */
  soportado(): boolean;
  estado(): EstadoConexion;
  /** Avisa cuando cambia el estado (para la pantalla). Regresa la función para dejar de escuchar. */
  suscribir(fn: () => void): () => void;
  /** Busca y elige la impresora (debe llamarse desde un toque). `null` si la conexión no elige equipo. */
  conectar(): Promise<DispositivoImpresora | null>;
  /** Vuelve a conectar sin preguntar, con la impresora guardada. */
  reconectar(config: ConfigImpresora): Promise<boolean>;
  imprimir(doc: TicketDocumento, config: ConfigImpresora): Promise<void>;
  /** Desconecta y quita el permiso de la impresora guardada. */
  olvidar(config: ConfigImpresora): Promise<void>;
}

export const MENSAJES_IMPRESORA = {
  conectada: 'Impresora conectada',
  noEncontrada: 'No se encontró la impresora. Revisa que esté encendida y cerca.',
  bluetoothClasico:
    'Esta impresora puede ser Bluetooth clásico, que el navegador no puede usar. Cambia el tipo de conexión a RawBT.',
  sinServicio: 'Esta impresora no tiene un servicio de impresión que el navegador pueda usar.',
  sinElegir: 'No hay impresora elegida. Búscala en Configuración › Impresora.',
  conexionPerdida: 'Se perdió la conexión. Vuelve a intentar.',
  rawbt: 'No se pudo abrir RawBT. Revisa que esté instalada en la tablet.',
  noResponde: 'No se pudo imprimir: la impresora no responde. Revisa que esté encendida y vuelve a intentar.',
  comanda: 'No se pudo imprimir la comanda de cocina.',
  ticketCliente: 'No se pudo imprimir el ticket del cliente.',
} as const;

export class ErrorImpresion extends Error {
  /** Qué hacer (p. ej. cambiar a RawBT), para mostrar debajo del error. */
  ayuda: string | undefined;
  constructor(mensaje: string, ayuda?: string) {
    super(mensaje);
    this.name = 'ErrorImpresion';
    this.ayuda = ayuda;
  }
}

/** Estado observable mínimo (lo comparten los drivers). */
export function crearEstado(inicial: EstadoConexion) {
  let actual = inicial;
  const oyentes = new Set<() => void>();
  return {
    obtener: () => actual,
    cambiar(nuevo: EstadoConexion) {
      if (nuevo === actual) return;
      actual = nuevo;
      for (const fn of oyentes) fn();
    },
    suscribir(fn: () => void) {
      oyentes.add(fn);
      return () => void oyentes.delete(fn);
    },
  };
}

/** Partes comunes de las conexiones que no eligen equipo (RawBT y sistema): siempre "listas". */
export const sinConexion = {
  estado: () => 'conectada' as const,
  suscribir: () => () => {},
  conectar: async () => null,
  reconectar: async () => true,
  olvidar: async () => {},
};
