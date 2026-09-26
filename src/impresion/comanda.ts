import { formatearHora } from '@/dominio/fechas';
import { resumenModificadores } from '@/dominio/modificadores';
import type { ConfigGeneral, ConfigTicket, LineaVenta, Venta } from '@/dominio/tipos';
import { SEPARADOR, texto, type LineaTicket, type OpcionesTicket, type TicketDocumento } from './ticket';

// Comanda de cocina: el mismo TicketDocumento que el del cliente, solo con lo que hay que
// preparar y sin precios. Letra doble donde ayuda a leerla de lejos.

export interface OpcionesComanda {
  imprimir: boolean;
  orden: 'cocina' | 'cliente';
  copias: number;
}

export const COMANDA_POR_DEFECTO: OpcionesComanda = { imprimir: true, orden: 'cocina', copias: 1 };

/** Opciones de la comanda (las configuraciones anteriores no las traen). */
export const opcionesComanda = (ticket: ConfigGeneral['ticket']): OpcionesComanda =>
  ticket.comanda ?? COMANDA_POR_DEFECTO;

/** Las ventas anteriores a "Va a cocina" no lo traen en sus líneas: cuentan como sí. */
export const vaACocina = (linea: Pick<LineaVenta, 'vaACocina'>) => linea.vaACocina !== false;

export interface OpcionesDocComanda extends OpcionesTicket {
  /** Aviso para barra de que la venta se canceló. */
  cancelada?: boolean;
}

function lineasDeProducto(linea: LineaVenta): LineaTicket[] {
  const l: LineaTicket[] = [texto(`${linea.cantidad}x ${linea.nombre}`, { negrita: true, doble: true })];
  if (linea.tamano) l.push(texto(`  ${linea.tamano.nombre}`, { negrita: true }));
  const ing = linea.ingredientes;
  if (ing && ing.nombres.length > 0) {
    l.push(texto(`  ${ing.nombres.join(', ')}${ing.extras > 0 ? ` (${ing.extras} extra)` : ''}`));
  }
  const modificadores = resumenModificadores(linea.modificadores);
  if (modificadores) l.push(texto(`  ${modificadores}`));
  if (linea.nota) l.push(texto(`>> NOTA: ${linea.nota}`, { negrita: true }));
  return l;
}

/** Comanda de una venta, o `null` si ninguna de sus líneas va a cocina. */
export function construirComanda(
  venta: Venta,
  config: Pick<ConfigTicket, 'zonaHoraria'>,
  opciones: OpcionesDocComanda = {},
): TicketDocumento | null {
  const lineas = venta.lineas.filter(vaACocina);
  if (lineas.length === 0) return null;

  const l: LineaTicket[] = [
    texto(opciones.cancelada ? 'COMANDA CANCELADA' : 'COCINA', {
      alineacion: 'centro',
      negrita: true,
      doble: true,
    }),
    texto(venta.folio, { alineacion: 'centro', negrita: true, doble: true }),
    texto(formatearHora(venta.fecha, config.zonaHoraria), { alineacion: 'centro' }),
  ];
  if (opciones.reimpresion) l.push(texto('*** REIMPRESIÓN ***', { alineacion: 'centro', negrita: true }));
  if (opciones.cancelada) l.push(texto('NO PREPARAR', { alineacion: 'centro', negrita: true }));
  if (venta.cliente) l.push(texto(`Para: ${venta.cliente}`, { negrita: true, doble: true }));
  l.push(texto(`${venta.cajero.nombre} · ${venta.dispositivoNombre}`, { chica: true }));
  for (const linea of lineas) l.push(SEPARADOR, ...lineasDeProducto(linea));
  l.push(SEPARADOR, { tipo: 'espacio' });
  return { columnas: opciones.columnas ?? 32, lineas: l };
}

export type TipoTrabajo = 'ticket' | 'comanda' | 'corte';

/** Un documento que se manda a la impresora como un trabajo aparte. */
export interface TrabajoImpresion {
  tipo: TipoTrabajo;
  doc: TicketDocumento;
  /** Si no se indica, las copias de la impresora. */
  copias?: number;
}

/** Lo que se imprime al cobrar: ticket del cliente y comanda (si aplica), en el orden configurado. */
export function trabajosDeVenta(
  venta: Venta,
  config: ConfigGeneral,
  ticket: TicketDocumento,
  columnas: 32 | 48,
): TrabajoImpresion[] {
  const cliente: TrabajoImpresion = { tipo: 'ticket', doc: ticket };
  const opciones = opcionesComanda(config.ticket);
  const doc = opciones.imprimir ? construirComanda(venta, config, { columnas }) : null;
  if (!doc) return [cliente];
  const comanda: TrabajoImpresion = { tipo: 'comanda', doc, copias: opciones.copias };
  return opciones.orden === 'cocina' ? [comanda, cliente] : [cliente, comanda];
}
