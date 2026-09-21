import { redondear, type Centavos } from './dinero';
import type { Devolucion, EstadoVenta, Turno, Venta } from './tipos';

export interface LineaADevolver {
  lineaId: string;
  cantidad: number;
}

export function puedeCancelar(venta: Venta, turnoDeLaVenta: Pick<Turno, 'estado'> | undefined): boolean {
  return venta.estado === 'pagada' && turnoDeLaVenta?.estado === 'abierto';
}

export function puedeDevolver(venta: Venta): boolean {
  return venta.estado === 'pagada' || venta.estado === 'devuelta_parcial';
}

/** Piezas ya devueltas de cada línea. */
export function cantidadesDevueltas(devoluciones: Pick<Devolucion, 'lineas'>[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const d of devoluciones)
    for (const l of d.lineas) mapa.set(l.lineaId, (mapa.get(l.lineaId) ?? 0) + l.cantidad);
  return mapa;
}

export type ResultadoReembolso =
  { ok: true; lineas: Devolucion['lineas']; monto: Centavos } | { ok: false; error: string };

/**
 * Reembolso proporcional al descuento: redondear(Σ importe devuelto × total / subtotal),
 * sin exceder total − devuelto. El importe de cada línea es su parte proporcional.
 */
export function calcularReembolso(
  venta: Venta,
  seleccion: LineaADevolver[],
  devolucionesPrevias: Pick<Devolucion, 'lineas'>[] = [],
): ResultadoReembolso {
  const previas = cantidadesDevueltas(devolucionesPrevias);
  const elegidas = seleccion.filter((s) => s.cantidad > 0);
  if (elegidas.length === 0) return { ok: false, error: 'Elige qué se devuelve.' };

  const brutos: { lineaId: string; cantidad: number; bruto: Centavos }[] = [];
  for (const s of elegidas) {
    const linea = venta.lineas.find((l) => l.id === s.lineaId);
    if (!linea) return { ok: false, error: 'La línea ya no existe en la venta.' };
    const disponible = linea.cantidad - (previas.get(linea.id) ?? 0);
    if (!Number.isInteger(s.cantidad) || s.cantidad > disponible) {
      return { ok: false, error: `Solo quedan ${disponible} de ${linea.nombre} por devolver.` };
    }
    brutos.push({ lineaId: linea.id, cantidad: s.cantidad, bruto: linea.precioUnitario * s.cantidad });
  }

  const proporcion = (importe: Centavos) =>
    venta.subtotal === 0 ? 0 : (importe * venta.total) / venta.subtotal;
  const sumaBruta = brutos.reduce((s, b) => s + b.bruto, 0);
  const monto = Math.min(redondear(proporcion(sumaBruta)), venta.total - venta.devuelto);

  // Reparte el monto entre las líneas; la última absorbe el redondeo.
  let asignado = 0;
  const lineas = brutos.map((b, i) => {
    const importe =
      i === brutos.length - 1 ? monto - asignado : Math.min(redondear(proporcion(b.bruto)), monto - asignado);
    asignado += importe;
    return { lineaId: b.lineaId, cantidad: b.cantidad, importe };
  });
  return { ok: true, lineas, monto };
}

/** Selección para devolver todo lo que queda de la venta. */
export function devolverTodo(
  venta: Venta,
  devolucionesPrevias: Pick<Devolucion, 'lineas'>[] = [],
): LineaADevolver[] {
  const previas = cantidadesDevueltas(devolucionesPrevias);
  return venta.lineas
    .map((l) => ({ lineaId: l.id, cantidad: l.cantidad - (previas.get(l.id) ?? 0) }))
    .filter((l) => l.cantidad > 0);
}

/** Estado y devuelto de la venta después de una devolución. */
export function aplicarDevolucion(
  venta: Venta,
  devolucion: Pick<Devolucion, 'lineas' | 'monto'>,
  devolucionesPrevias: Pick<Devolucion, 'lineas'>[] = [],
): { estado: EstadoVenta; devuelto: Centavos } {
  const devuelto = venta.devuelto + devolucion.monto;
  const quedan = devolverTodo(venta, [...devolucionesPrevias, devolucion]).length > 0;
  const completa = !quedan || (venta.total > 0 && devuelto >= venta.total);
  return { estado: completa ? 'devuelta' : 'devuelta_parcial', devuelto };
}
