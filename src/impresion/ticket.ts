import { tipoDiferencia } from '@/dominio/caja';
import { NOMBRE_METODO } from '@/dominio/cobro';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';
import { resumenModificadores } from '@/dominio/modificadores';
import type { ConfigGeneral, Turno, Venta } from '@/dominio/tipos';

// Ticket como datos puros; los renderizadores (HTML y ESC/POS) solo lo dibujan.

export type Alineacion = 'izquierda' | 'centro' | 'derecha';

export type LineaTicket =
  | { tipo: 'texto'; texto: string; alineacion?: Alineacion; negrita?: boolean; doble?: boolean }
  | { tipo: 'columnas'; izquierda: string; derecha: string; negrita?: boolean }
  | { tipo: 'separador' }
  | { tipo: 'logo'; dataUrl: string }
  | { tipo: 'qr'; contenido: string }
  | { tipo: 'espacio' }
  | { tipo: 'corte' };

export interface TicketDocumento {
  columnas: 32 | 48;
  lineas: LineaTicket[];
}

export const columnasDeAncho = (ancho: 58 | 80): 32 | 48 => (ancho === 80 ? 48 : 32);

const texto = (
  t: string,
  extra: Omit<Extract<LineaTicket, { tipo: 'texto' }>, 'tipo' | 'texto'> = {},
): LineaTicket => ({
  tipo: 'texto',
  texto: t,
  ...extra,
});
const columnas = (izquierda: string, derecha: string, negrita?: boolean): LineaTicket => ({
  tipo: 'columnas',
  izquierda,
  derecha,
  ...(negrita ? { negrita } : {}),
});
const SEPARADOR: LineaTicket = { tipo: 'separador' };
const porcentaje = (tasa: number) => `${Math.round(tasa * 10000) / 100}%`;

function encabezado(config: ConfigGeneral): LineaTicket[] {
  const { negocio, ticket } = config;
  const lineas: LineaTicket[] = [];
  if (ticket.mostrarLogo && negocio.logo) lineas.push({ tipo: 'logo', dataUrl: negocio.logo });
  lineas.push(texto(negocio.nombre.toLocaleUpperCase('es-MX'), { alineacion: 'centro', negrita: true }));
  if (ticket.mostrarDireccion && negocio.direccion)
    lineas.push(texto(negocio.direccion, { alineacion: 'centro' }));
  if (ticket.mostrarTelefono && negocio.telefono)
    lineas.push(texto(`Tel. ${negocio.telefono}`, { alineacion: 'centro' }));
  if (ticket.mostrarRFC && negocio.rfc) lineas.push(texto(`RFC ${negocio.rfc}`, { alineacion: 'centro' }));
  return lineas;
}

export interface OpcionesTicketVenta {
  reimpresion?: boolean;
  /** Contenido del QR (enlace al ticket digital), si se usa. */
  qr?: string;
}

export function construirTicketVenta(
  venta: Venta,
  config: ConfigGeneral,
  opciones: OpcionesTicketVenta = {},
): TicketDocumento {
  const { ticket, zonaHoraria } = config;
  const l: LineaTicket[] = [...encabezado(config), SEPARADOR];

  if (opciones.reimpresion) l.push(texto('*** REIMPRESIÓN ***', { alineacion: 'centro', negrita: true }));
  if (venta.estado === 'cancelada')
    l.push(texto('*** VENTA CANCELADA ***', { alineacion: 'centro', negrita: true }));
  l.push(texto(`Folio: ${venta.folio}`, { negrita: true }));
  l.push(columnas(formatearFechaHora(venta.fecha, zonaHoraria), venta.dispositivoNombre));
  if (ticket.mostrarCajero) l.push(texto(`Cajero: ${venta.cajero.nombre}`));
  if (venta.cliente) l.push(texto(`Para: ${venta.cliente}`));
  l.push(SEPARADOR);

  for (const linea of venta.lineas) {
    l.push(columnas(`${linea.cantidad} ${linea.nombre}`, formatearDinero(linea.importe)));
    if (linea.cantidad > 1) l.push(texto(`  ${linea.cantidad} x ${formatearDinero(linea.precioUnitario)}`));
    const resumen = resumenModificadores(linea.modificadores);
    if (resumen) l.push(texto(`  ${resumen}`));
    if (linea.nota) l.push(texto(`  Nota: ${linea.nota}`));
  }
  l.push(SEPARADOR);

  l.push(columnas('Subtotal', formatearDinero(venta.subtotal)));
  if (venta.descuento) {
    const etiqueta =
      venta.descuento.tipo === 'porcentaje' ? `Descuento ${venta.descuento.valor}%` : 'Descuento';
    l.push(columnas(etiqueta, formatearDinero(-venta.descuento.importe)));
  }
  const conIVA = config.ventas.mostrarDesgloseIVA && venta.iva.tasa > 0;
  if (conIVA && !venta.iva.incluido)
    l.push(columnas(`IVA ${porcentaje(venta.iva.tasa)}`, formatearDinero(venta.iva.monto)));
  l.push(columnas('TOTAL', formatearDinero(venta.total), true));
  if (conIVA && venta.iva.incluido) {
    l.push(columnas(`IVA incluido ${porcentaje(venta.iva.tasa)}`, formatearDinero(venta.iva.monto)));
  }
  if (venta.devuelto > 0) l.push(columnas('Devuelto', formatearDinero(-venta.devuelto)));

  if (venta.pagos.length > 0) {
    l.push(SEPARADOR);
    for (const p of venta.pagos) {
      if (p.metodo === 'efectivo') {
        l.push(columnas('Efectivo recibido', formatearDinero(p.recibido ?? p.monto)));
      } else {
        l.push(columnas(NOMBRE_METODO[p.metodo], formatearDinero(p.monto)));
        if (p.referencia) l.push(texto(`  Ref. ${p.referencia}`));
      }
    }
    if (venta.pagos.some((p) => p.metodo === 'efectivo'))
      l.push(columnas('Cambio', formatearDinero(venta.cambio)));
  }

  if (venta.estado === 'cancelada' && venta.cancelacion) {
    l.push(SEPARADOR, texto(`Cancelada: ${venta.cancelacion.motivo}`));
  }
  if (ticket.mensajeFinal || opciones.qr) l.push(SEPARADOR);
  if (ticket.mensajeFinal) l.push(texto(ticket.mensajeFinal, { alineacion: 'centro' }));
  if (opciones.qr) l.push({ tipo: 'qr', contenido: opciones.qr });
  l.push({ tipo: 'espacio' }, { tipo: 'corte' });
  return { columnas: columnasDeAncho(ticket.ancho), lineas: l };
}

/** Ticket de corte de un turno cerrado (usa el resumen guardado al cerrar). */
export function construirTicketCorte(
  turno: Turno,
  config: ConfigGeneral,
  opciones: { reimpresion?: boolean } = {},
): TicketDocumento {
  const r = turno.resumen;
  if (!r) throw new Error('El turno no tiene corte todavía.');
  const zona = config.zonaHoraria;
  const $ = formatearDinero;
  const l: LineaTicket[] = [
    texto(config.negocio.nombre.toLocaleUpperCase('es-MX'), { alineacion: 'centro', negrita: true }),
    texto('Corte de caja', { alineacion: 'centro', negrita: true, doble: true }),
    SEPARADOR,
  ];
  if (opciones.reimpresion) l.push(texto('*** REIMPRESIÓN ***', { alineacion: 'centro', negrita: true }));
  l.push(texto(turno.dispositivoNombre, { negrita: true }));
  l.push(texto(`Abrió: ${turno.abiertoPor.nombre} ${formatearFechaHora(turno.abiertoEn, zona)}`));
  if (turno.cerradoPor && turno.cerradoEn) {
    l.push(texto(`Cerró: ${turno.cerradoPor.nombre} ${formatearFechaHora(turno.cerradoEn, zona)}`));
  }
  l.push(SEPARADOR);

  l.push(columnas(`Ventas (${r.ventas})`, $(r.totalVendido), true));
  l.push(columnas('  Efectivo', $(r.porMetodo.efectivo)));
  l.push(columnas('  Tarjeta', $(r.porMetodo.tarjeta)));
  l.push(columnas('  Transferencia', $(r.porMetodo.transferencia)));
  if (r.descuentos) l.push(columnas('Descuentos', $(r.descuentos)));
  l.push(columnas(`Cancelaciones (${r.cancelaciones.cantidad})`, $(r.cancelaciones.importe)));
  l.push(columnas(`Devoluciones (${r.devoluciones.cantidad})`, $(r.devoluciones.importe)));
  l.push(SEPARADOR);

  l.push(columnas('Fondo inicial', $(r.fondoInicial)));
  l.push(columnas('+ Ventas en efectivo', $(r.porMetodo.efectivo)));
  l.push(columnas('+ Entradas', $(r.entradas)));
  l.push(columnas('- Retiros', $(r.retiros)));
  l.push(columnas('- Gastos', $(r.gastos.total)));
  l.push(columnas('- Devoluciones efectivo', $(r.devoluciones.efectivo)));
  l.push(columnas('Efectivo esperado', $(r.efectivoEsperado), true));
  if (r.efectivoContado !== null && r.diferencia !== null) {
    l.push(columnas('Efectivo contado', $(r.efectivoContado), true));
    const tipo = tipoDiferencia(r.diferencia);
    const etiqueta = tipo === 'faltante' ? 'Faltan' : tipo === 'sobrante' ? 'Sobran' : 'Cuadra exacto';
    l.push(columnas(`Diferencia: ${etiqueta}`, tipo === 'exacto' ? $(0) : $(Math.abs(r.diferencia)), true));
  }

  const categorias = Object.entries(r.gastos.porCategoria);
  if (categorias.length > 0) {
    l.push(SEPARADOR, texto('Gastos por categoría', { negrita: true }));
    for (const [categoria, monto] of categorias) l.push(columnas(`  ${categoria}`, $(monto)));
  }
  if (turno.nota) l.push(SEPARADOR, texto(`Nota: ${turno.nota}`));
  l.push({ tipo: 'espacio' }, { tipo: 'corte' });
  return { columnas: columnasDeAncho(config.ticket.ancho), lineas: l };
}

// Texto plano (para compartir, vista en pantalla y ESC/POS): cada línea ya ajustada al ancho.

/** Parte un texto en renglones de `ancho` columnas, por palabras (corta las palabras más largas). */
export function envolver(t: string, ancho: number): string[] {
  const renglones: string[] = [];
  let actual = '';
  for (let palabra of t.split(/\s+/).filter(Boolean)) {
    while (palabra.length > ancho) {
      if (actual) renglones.push(actual);
      renglones.push(palabra.slice(0, ancho));
      palabra = palabra.slice(ancho);
      actual = '';
    }
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length <= ancho) {
      actual = candidato;
    } else {
      renglones.push(actual);
      actual = palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones.length ? renglones : [''];
}

const sangriaDe = (t: string) => t.match(/^\s*/)?.[0] ?? '';

function alinear(t: string, ancho: number, alineacion: Alineacion = 'izquierda'): string {
  if (alineacion === 'izquierda') return t;
  const libre = Math.max(0, ancho - t.length);
  return alineacion === 'derecha' ? ' '.repeat(libre) + t : ' '.repeat(Math.floor(libre / 2)) + t;
}

export interface RenglonTicket {
  texto: string;
  negrita?: boolean;
  doble?: boolean;
}

/** Renglones de texto de una línea del ticket (sin logo, QR ni corte). */
export function renglonesDe(linea: LineaTicket, ancho: number): RenglonTicket[] {
  switch (linea.tipo) {
    case 'texto': {
      const efectivo = linea.doble ? Math.floor(ancho / 2) : ancho;
      const sangria = sangriaDe(linea.texto);
      return envolver(linea.texto, efectivo - sangria.length).map((r) => ({
        texto: alinear(sangria + r, efectivo, linea.alineacion),
        negrita: linea.negrita,
        doble: linea.doble,
      }));
    }
    case 'columnas': {
      const { derecha } = linea;
      const sangria = sangriaDe(linea.izquierda);
      const [primero = '', ...resto] = envolver(linea.izquierda, ancho - derecha.length - 1 - sangria.length);
      const inicio = sangria + primero;
      return [
        {
          texto: inicio + ' '.repeat(ancho - inicio.length - derecha.length) + derecha,
          negrita: linea.negrita,
        },
        ...resto.map((r) => ({ texto: `${sangria}  ${r}`, negrita: linea.negrita })),
      ];
    }
    case 'separador':
      return [{ texto: '-'.repeat(ancho) }];
    case 'espacio':
      return [{ texto: '' }];
    default:
      return [];
  }
}

/** Ticket completo como texto plano (compartir por WhatsApp, pruebas). */
export function ticketATexto(doc: TicketDocumento): string {
  return doc.lineas
    .flatMap((l) => renglonesDe(l, doc.columnas))
    .map((r) => r.texto.trimEnd())
    .join('\n')
    .trimEnd();
}
