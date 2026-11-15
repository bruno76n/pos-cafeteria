import type { Centavos } from './dinero.js';
import type { Cuenta, LineaVenta, Pedido } from './tipos.js';

// Reglas puras de las cuentas abiertas (docs/01-especificacion.md §5.2b): numeración, estados,
// consolidación de pedidos y anulaciones. Sin Dexie, sin red y sin React.

/** Número de la próxima cuenta: `cuentasDelDia` son las de este dispositivo en ese día. */
export function siguienteNumeroCuenta(cuentasDelDia: Pick<Cuenta, 'numero'>[]): number {
  return cuentasDelDia.reduce((mayor, c) => Math.max(mayor, c.numero), 0) + 1;
}

/** Número de la próxima comanda de una cuenta (las anulaciones también cuentan: también se imprimen). */
export function siguienteComanda(pedidos: Pick<Pedido, 'numero'>[]): number {
  return pedidos.reduce((mayor, p) => Math.max(mayor, p.numero), 0) + 1;
}

/** Pedidos en el orden en que se enviaron. */
export function ordenarPedidos<T extends Pick<Pedido, 'numero' | 'fecha'>>(pedidos: T[]): T[] {
  return [...pedidos].sort((a, b) => a.numero - b.numero || a.fecha.localeCompare(b.fecha));
}

/** "Cuenta 12" o "Cuenta 12 · Luis". */
export function etiquetaCuenta(cuenta: Pick<Cuenta, 'numero' | 'nombre'>): string {
  return cuenta.nombre ? `Cuenta ${cuenta.numero} · ${cuenta.nombre}` : `Cuenta ${cuenta.numero}`;
}

/** "Cuenta 12". */
export const numeroDeCuenta = (cuenta: Pick<Cuenta, 'numero'>) => `Cuenta ${cuenta.numero}`;

/** "Comanda 2", o "Comanda 2 de 3" si se conoce el total (reimpresiones y ticket final). */
export const etiquetaComanda = (comanda: number, deTotal?: number) =>
  `Comanda ${comanda}${deTotal ? ` de ${deTotal}` : ''}`;

/** Aviso al cerrar caja: las cuentas abiertas no impiden cerrar; se cobrarán en el turno que esté abierto. */
export function avisoCuentasAbiertas(cuentas: Pick<Cuenta, 'numero' | 'nombre'>[]): string | null {
  if (cuentas.length === 0) return null;
  const lista = cuentas.map(etiquetaCuenta).join(', ');
  return cuentas.length === 1
    ? `Hay 1 cuenta abierta (${lista}). Se cobrará en el turno que esté abierto.`
    : `Hay ${cuentas.length} cuentas abiertas (${lista}). Se cobrarán en el turno que esté abierto.`;
}

/** Una cuenta solo se envía, se cobra o se cancela mientras está abierta. */
export const estaAbierta = (cuenta: Pick<Cuenta, 'estado'>) => cuenta.estado === 'abierta';

const conCantidad = (linea: LineaVenta, cantidad: number): LineaVenta => ({
  ...linea,
  cantidad,
  importe: linea.precioUnitario * cantidad,
});

/**
 * Líneas vigentes de la cuenta: suma las de los pedidos normales (cada una con el número de su
 * comanda) y resta las anulaciones por `id` de línea. Las que quedan en cero desaparecen. No depende
 * del orden de llegada: dos tablets pueden sincronizar los pedidos en cualquier orden.
 */
export function consolidarLineas(
  pedidos: Pick<Pedido, 'numero' | 'fecha' | 'tipo' | 'lineas'>[],
): LineaVenta[] {
  const ordenados = ordenarPedidos(pedidos);
  const anuladas = new Map<string, number>();
  for (const p of ordenados) {
    if (p.tipo !== 'anulacion') continue;
    for (const l of p.lineas) anuladas.set(l.id, (anuladas.get(l.id) ?? 0) + l.cantidad);
  }
  return ordenados
    .filter((p) => p.tipo === 'normal')
    .flatMap((p) => p.lineas.map((l) => ({ ...l, comanda: p.numero })))
    .flatMap((linea) => {
      const quitar = Math.min(anuladas.get(linea.id) ?? 0, linea.cantidad);
      if (quitar > 0) anuladas.set(linea.id, (anuladas.get(linea.id) ?? 0) - quitar);
      return linea.cantidad - quitar > 0 ? [conCantidad(linea, linea.cantidad - quitar)] : [];
    });
}

export const subtotalDe = (lineas: Pick<LineaVenta, 'importe'>[]): Centavos =>
  lineas.reduce((suma, l) => suma + l.importe, 0);

export type ResultadoAnulacion = { ok: true; linea: LineaVenta } | { ok: false; error: string };

/** La línea de una anulación: la misma línea (mismo `id`) con la cantidad que se quita. */
export function lineaDeAnulacion(
  vigentes: LineaVenta[],
  lineaId: string,
  cantidad: number,
): ResultadoAnulacion {
  const linea = vigentes.find((l) => l.id === lineaId);
  if (!linea) return { ok: false, error: 'Esa línea ya no está en la cuenta.' };
  if (!Number.isInteger(cantidad) || cantidad < 1) return { ok: false, error: 'Elige cuántas anular.' };
  if (cantidad > linea.cantidad) {
    return { ok: false, error: `Solo quedan ${linea.cantidad} en la cuenta.` };
  }
  return { ok: true, linea: conCantidad(linea, cantidad) };
}
