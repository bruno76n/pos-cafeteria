import { z } from 'zod';
import { columnasDeAncho } from './ticket';

// Impresora de este dispositivo: se guarda en la base local (meta 'impresora') y no se sincroniza.

export const TIPOS_IMPRESORA = ['bluetooth', 'rawbt', 'sistema'] as const;
export type TipoImpresora = (typeof TIPOS_IMPRESORA)[number];

export type Densidad = 'baja' | 'normal' | 'alta';

/** Impresora Bluetooth elegida: el id sirve para reconectar sin volver a buscar. */
export interface DispositivoImpresora {
  id: string;
  nombre: string;
}

export interface ConfigImpresora {
  tipo: TipoImpresora;
  dispositivo: DispositivoImpresora | null;
  ancho: 58 | 80;
  densidad: Densidad;
  /** Renglones en blanco al final para que el ticket salga de la impresora. */
  avance: number;
  /** Muchas impresoras de 58 mm no tienen cortador: apagado por defecto. */
  cortar: boolean;
  copias: number;
  imprimirAlCobrar: boolean;
}

export const AVANCE_MAXIMO = 8;
export const COPIAS_MAXIMAS = 3;

export const CONFIG_IMPRESORA_POR_DEFECTO: ConfigImpresora = {
  tipo: 'sistema',
  dispositivo: null,
  ancho: 58,
  densidad: 'normal',
  avance: 3,
  cortar: false,
  copias: 1,
  imprimirAlCobrar: false,
};

const d = CONFIG_IMPRESORA_POR_DEFECTO;
const esquema = z.object({
  tipo: z.enum(TIPOS_IMPRESORA).catch(d.tipo),
  dispositivo: z
    .object({ id: z.string().min(1), nombre: z.string() })
    .nullable()
    .catch(d.dispositivo),
  ancho: z.union([z.literal(58), z.literal(80)]).catch(d.ancho),
  densidad: z.enum(['baja', 'normal', 'alta']).catch(d.densidad),
  avance: z.number().int().min(0).max(AVANCE_MAXIMO).catch(d.avance),
  cortar: z.boolean().catch(d.cortar),
  copias: z.number().int().min(1).max(COPIAS_MAXIMAS).catch(d.copias),
  imprimirAlCobrar: z.boolean().catch(d.imprimirAlCobrar),
});

/**
 * Completa con los valores por defecto lo que falte o no sea válido. La versión anterior guardaba
 * `{ tipo: 'navegador' | 'usb' | 'bluetooth', reconexion }`: navegador y USB pasan a Sistema y la
 * impresora Bluetooth conserva su id.
 */
export function normalizarConfigImpresora(valor: unknown): ConfigImpresora {
  const crudo = (typeof valor === 'object' && valor !== null ? valor : {}) as Record<string, unknown>;
  const anterior = crudo.reconexion as { id?: unknown; nombre?: unknown } | null | undefined;
  const dispositivo =
    crudo.dispositivo ??
    (typeof anterior?.id === 'string'
      ? { id: anterior.id, nombre: typeof anterior.nombre === 'string' ? anterior.nombre : 'Impresora' }
      : null);
  return esquema.parse({ ...crudo, dispositivo });
}

export const columnasDeImpresora = (config: Pick<ConfigImpresora, 'ancho'>) => columnasDeAncho(config.ancho);
