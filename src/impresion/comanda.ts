import { etiquetaComanda, numeroDeCuenta } from '@/dominio/cuentas';
import { formatearHora } from '@/dominio/fechas';
import { resumenModificadores } from '@/dominio/modificadores';
import type { ConfigGeneral, ConfigTicket, Cuenta, LineaVenta, Pedido, Venta } from '@/dominio/tipos';
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

/** Lo que una comanda necesita saber, venga de un pedido o de una venta. */
export interface DatosComanda {
  /**
   * Lo que se lee en grande bajo "COCINA", una línea por elemento (la letra doble solo cabe en la
   * mitad de las columnas): el folio de la venta, o la cuenta y la comanda.
   */
  titulo: string[];
  fecha: string;
  cliente: string | null;
  cajero: string;
  dispositivoNombre: string;
  lineas: LineaVenta[];
}

/** Comanda de una venta sin cuenta (anterior a las cuentas): el folio es el título. */
export function datosDeVenta(venta: Venta): DatosComanda {
  return {
    titulo: [venta.folio],
    fecha: venta.fecha,
    cliente: venta.cliente,
    cajero: venta.cajero.nombre,
    dispositivoNombre: venta.dispositivoNombre,
    lineas: venta.lineas,
  };
}

/**
 * Comanda de un pedido de una cuenta: "Cuenta 12" y "Comanda 2". Con `totalPedidos` (reimpresiones)
 * dice "Comanda 2 de 3". `dispositivoNombre` es la caja desde donde se envía, si no es la que abrió la cuenta.
 */
export function datosDePedido(
  cuenta: Pick<Cuenta, 'numero' | 'nombre' | 'dispositivoNombre'>,
  pedido: Pick<Pedido, 'numero' | 'fecha' | 'lineas' | 'enviadoPor'>,
  opciones: { totalPedidos?: number; dispositivoNombre?: string } = {},
): DatosComanda {
  return {
    titulo: [numeroDeCuenta(cuenta), etiquetaComanda(pedido.numero, opciones.totalPedidos)],
    fecha: pedido.fecha,
    cliente: cuenta.nombre,
    cajero: pedido.enviadoPor.nombre,
    dispositivoNombre: opciones.dispositivoNombre ?? cuenta.dispositivoNombre,
    lineas: pedido.lineas,
  };
}

/** Aviso de cuenta cancelada: la cuenta y lo que ya se había mandado a cocina (`lineas` vigentes). */
export function datosDeCuenta(
  cuenta: Pick<Cuenta, 'numero' | 'nombre' | 'dispositivoNombre' | 'abiertaPor' | 'cancelacion' | 'fecha'>,
  lineas: LineaVenta[],
): DatosComanda {
  return {
    titulo: [numeroDeCuenta(cuenta)],
    fecha: cuenta.cancelacion?.fecha ?? cuenta.fecha,
    cliente: cuenta.nombre,
    cajero: (cuenta.cancelacion?.usuario ?? cuenta.abiertaPor).nombre,
    dispositivoNombre: cuenta.dispositivoNombre,
    lineas,
  };
}

export interface OpcionesDocComanda extends OpcionesTicket {
  /** Aviso para barra de que la venta (o la cuenta) se canceló. */
  cancelada?: boolean;
  /** Pedido de anulación: avisa que NO se prepare lo que ya se había pedido. */
  anulacion?: boolean;
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

/** Comanda de lo que se manda a cocina, o `null` si ninguna de sus líneas va a cocina. */
export function construirComanda(
  datos: DatosComanda,
  config: Pick<ConfigTicket, 'zonaHoraria'>,
  opciones: OpcionesDocComanda = {},
): TicketDocumento | null {
  const lineas = datos.lineas.filter(vaACocina);
  if (lineas.length === 0) return null;

  const encabezado = opciones.cancelada ? 'COMANDA CANCELADA' : opciones.anulacion ? 'ANULACIÓN' : 'COCINA';
  const l: LineaTicket[] = [
    texto(encabezado, { alineacion: 'centro', negrita: true, doble: true }),
    ...datos.titulo.map((t) => texto(t, { alineacion: 'centro', negrita: true, doble: true })),
    texto(formatearHora(datos.fecha, config.zonaHoraria), { alineacion: 'centro' }),
  ];
  if (opciones.reimpresion) l.push(texto('*** REIMPRESIÓN ***', { alineacion: 'centro', negrita: true }));
  if (opciones.cancelada || opciones.anulacion)
    l.push(texto('NO PREPARAR', { alineacion: 'centro', negrita: true }));
  if (datos.cliente) l.push(texto(`Para: ${datos.cliente}`, { negrita: true, doble: true }));
  l.push(texto(`${datos.cajero} · ${datos.dispositivoNombre}`, { chica: true }));
  for (const linea of lineas) {
    l.push(SEPARADOR, ...lineasDeProducto(linea));
    if (opciones.anulacion && linea.comanda) l.push(texto(`  (de la comanda ${linea.comanda})`));
  }
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

/** La comanda de un pedido (vacío si está apagada o si nada va a cocina). */
export function trabajosDePedido(
  datos: DatosComanda,
  config: ConfigGeneral,
  columnas: 32 | 48,
  opciones: OpcionesDocComanda = {},
): TrabajoImpresion[] {
  const ajustes = opcionesComanda(config.ticket);
  const doc = ajustes.imprimir ? construirComanda(datos, config, { ...opciones, columnas }) : null;
  return doc ? [{ tipo: 'comanda', doc, copias: ajustes.copias }] : [];
}

/** El ticket del cliente al cobrar. */
export const trabajosDeCobro = (ticket: TicketDocumento): TrabajoImpresion[] => [
  { tipo: 'ticket', doc: ticket },
];

/** Venta rápida: ticket y comanda salen juntos, en el orden configurado. */
export function trabajosDeVentaRapida(
  datos: DatosComanda,
  config: ConfigGeneral,
  ticket: TicketDocumento,
  columnas: 32 | 48,
): TrabajoImpresion[] {
  const comanda = trabajosDePedido(datos, config, columnas);
  const cliente = trabajosDeCobro(ticket);
  return opcionesComanda(config.ticket).orden === 'cocina'
    ? [...comanda, ...cliente]
    : [...cliente, ...comanda];
}
