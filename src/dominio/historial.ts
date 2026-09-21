import { coincide } from './texto';
import type { EstadoVenta, MetodoPago, Venta } from './tipos';

export const NOMBRE_ESTADO: Record<EstadoVenta, string> = {
  pagada: 'Pagada',
  cancelada: 'Cancelada',
  devuelta_parcial: 'Devuelta parcial',
  devuelta: 'Devuelta',
};

export interface FiltrosVentas {
  metodo: MetodoPago | null;
  cajeroId: string | null;
  estado: EstadoVenta | null;
  folio: string;
}

export const SIN_FILTROS: FiltrosVentas = { metodo: null, cajeroId: null, estado: null, folio: '' };

/** Filtra por método de pago, cajero, estado y folio (parcial: "123" encuentra "A-000123"). Más recientes primero. */
export function filtrarVentas(ventas: Venta[], f: FiltrosVentas): Venta[] {
  return ventas
    .filter(
      (v) =>
        (!f.metodo || v.pagos.some((p) => p.metodo === f.metodo)) &&
        (!f.cajeroId || v.cajero.id === f.cajeroId) &&
        (!f.estado || v.estado === f.estado) &&
        (!f.folio.trim() || coincide(v.folio, f.folio.trim())),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** "2 Latte, 1 Brownie" */
export function resumenProductos(venta: Pick<Venta, 'lineas'>): string {
  return venta.lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(', ');
}

/** Cajeros que aparecen en las ventas (para el filtro). */
export function cajerosDe(ventas: Venta[]): { id: string; nombre: string }[] {
  const mapa = new Map(ventas.map((v) => [v.cajero.id, v.cajero.nombre]));
  return [...mapa]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
