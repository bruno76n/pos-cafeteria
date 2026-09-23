import type { Centavos } from './dinero.js';
import { formatearFecha, sumarDias } from './fechas.js';
import type { Devolucion, MetodoPago, Movimiento, ResumenTurno, Turno, Venta } from './tipos.js';

export type { ResumenTurno } from './tipos.js';

/** Denominaciones para contar el efectivo al cerrar caja (clave → valor en centavos). */
export const DENOMINACIONES: { clave: string; nombre: string; valor: Centavos }[] = [
  { clave: 'b1000', nombre: 'Billete de $1,000', valor: 100000 },
  { clave: 'b500', nombre: 'Billete de $500', valor: 50000 },
  { clave: 'b200', nombre: 'Billete de $200', valor: 20000 },
  { clave: 'b100', nombre: 'Billete de $100', valor: 10000 },
  { clave: 'b50', nombre: 'Billete de $50', valor: 5000 },
  { clave: 'b20', nombre: 'Billete de $20', valor: 2000 },
  { clave: 'm20', nombre: 'Moneda de $20', valor: 2000 },
  { clave: 'm10', nombre: 'Moneda de $10', valor: 1000 },
  { clave: 'm5', nombre: 'Moneda de $5', valor: 500 },
  { clave: 'm2', nombre: 'Moneda de $2', valor: 200 },
  { clave: 'm1', nombre: 'Moneda de $1', valor: 100 },
  { clave: 'm050', nombre: 'Moneda de 50¢', valor: 50 },
];

/** Suma de un conteo por denominaciones (clave → piezas). */
export function totalConteo(conteo: Record<string, number>): Centavos {
  return DENOMINACIONES.reduce((s, d) => s + d.valor * (conteo[d.clave] ?? 0), 0);
}

export const ventaCuenta = (v: Venta) => v.estado !== 'cancelada';

export function montoPorMetodo(ventas: Venta[]): Record<MetodoPago, Centavos> {
  const r: Record<MetodoPago, Centavos> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const v of ventas) for (const p of v.pagos) r[p.metodo] += p.monto;
  return r;
}

export function agregarPorProducto(ventas: Venta[]): ResumenTurno['porProducto'] {
  const mapa = new Map<string, ResumenTurno['porProducto'][number]>();
  for (const v of ventas) {
    for (const l of v.lineas) {
      const a = mapa.get(l.productoId) ?? {
        productoId: l.productoId,
        nombre: l.nombre,
        categoriaNombre: l.categoriaNombre,
        cantidad: 0,
        importe: 0,
      };
      a.cantidad += l.cantidad;
      a.importe += l.importe;
      mapa.set(l.productoId, a);
    }
  }
  return [...mapa.values()].sort((a, b) => b.importe - a.importe || b.cantidad - a.cantidad);
}

export function agregarPorCategoria(ventas: Venta[]): ResumenTurno['porCategoria'] {
  const mapa = new Map<string, ResumenTurno['porCategoria'][number]>();
  for (const v of ventas) {
    for (const l of v.lineas) {
      const a = mapa.get(l.categoriaId) ?? {
        categoriaId: l.categoriaId,
        nombre: l.categoriaNombre,
        cantidad: 0,
        importe: 0,
      };
      a.cantidad += l.cantidad;
      a.importe += l.importe;
      mapa.set(l.categoriaId, a);
    }
  }
  return [...mapa.values()].sort((a, b) => b.importe - a.importe);
}

export function agregarPorCajero(ventas: Venta[]): ResumenTurno['porCajero'] {
  const mapa = new Map<string, ResumenTurno['porCajero'][number]>();
  for (const v of ventas) {
    const a = mapa.get(v.cajero.id) ?? {
      usuarioId: v.cajero.id,
      nombre: v.cajero.nombre,
      ventas: 0,
      cantidad: 0,
      importe: 0,
    };
    a.ventas += 1;
    a.cantidad += v.lineas.reduce((n, l) => n + l.cantidad, 0);
    a.importe += v.total;
    mapa.set(v.cajero.id, a);
  }
  return [...mapa.values()].sort((a, b) => b.importe - a.importe);
}

export function sumarMovimientos(movimientos: Movimiento[]) {
  const vigentes = movimientos.filter((m) => !m.anulado);
  const suma = (tipo: Movimiento['tipo']) =>
    vigentes.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0);
  const porCategoria: Record<string, Centavos> = {};
  for (const m of vigentes) {
    if (m.tipo !== 'gasto') continue;
    const cat = m.categoria ?? 'Sin categoría';
    porCategoria[cat] = (porCategoria[cat] ?? 0) + m.monto;
  }
  return {
    entradas: suma('entrada'),
    retiros: suma('retiro'),
    gastos: { total: suma('gasto'), porCategoria },
  };
}

export interface DatosTurno {
  turno: Pick<Turno, 'id' | 'fondoInicial'>;
  /** Ventas del turno (se filtran por turnoId). */
  ventas: Venta[];
  /** Movimientos del turno (se filtran por turnoId). */
  movimientos: Movimiento[];
  /** Devoluciones hechas durante el turno (se filtran por turnoId). */
  devoluciones: Devolucion[];
  /** Efectivo contado al cerrar; null mientras no se cuenta. */
  contado?: Centavos | null;
}

/**
 * efectivoEsperado = fondo + efectivo de ventas no canceladas + entradas − retiros − gastos
 * − devoluciones en efectivo del turno. diferencia = contado − esperado.
 */
export function resumirTurno(datos: DatosTurno): ResumenTurno {
  const { turno } = datos;
  const delTurno = datos.ventas.filter((v) => v.turnoId === turno.id);
  const vigentes = delTurno.filter(ventaCuenta);
  const canceladas = delTurno.filter((v) => !ventaCuenta(v));
  const devoluciones = datos.devoluciones.filter((d) => d.turnoId === turno.id);
  const movs = sumarMovimientos(datos.movimientos.filter((m) => m.turnoId === turno.id));
  const porMetodo = montoPorMetodo(vigentes);
  const devueltoEfectivo = devoluciones
    .filter((d) => d.metodo === 'efectivo')
    .reduce((s, d) => s + d.monto, 0);

  const efectivoEsperado =
    turno.fondoInicial +
    porMetodo.efectivo +
    movs.entradas -
    movs.retiros -
    movs.gastos.total -
    devueltoEfectivo;
  const contado = datos.contado ?? null;

  return {
    ventas: vigentes.length,
    totalVendido: vigentes.reduce((s, v) => s + v.total, 0),
    porMetodo,
    descuentos: vigentes.reduce((s, v) => s + (v.descuento?.importe ?? 0), 0),
    cancelaciones: { cantidad: canceladas.length, importe: canceladas.reduce((s, v) => s + v.total, 0) },
    devoluciones: {
      cantidad: devoluciones.length,
      importe: devoluciones.reduce((s, d) => s + d.monto, 0),
      efectivo: devueltoEfectivo,
    },
    entradas: movs.entradas,
    retiros: movs.retiros,
    gastos: movs.gastos,
    fondoInicial: turno.fondoInicial,
    efectivoEsperado,
    efectivoContado: contado,
    diferencia: contado === null ? null : contado - efectivoEsperado,
    porProducto: agregarPorProducto(vigentes),
    porCategoria: agregarPorCategoria(vigentes),
    porCajero: agregarPorCajero(vigentes),
  };
}

/** "Faltan $15.00" / "Sobran $20.00" / "Cuadra exacto" según la diferencia. */
export function tipoDiferencia(diferencia: Centavos): 'faltante' | 'sobrante' | 'exacto' {
  return diferencia < 0 ? 'faltante' : diferencia > 0 ? 'sobrante' : 'exacto';
}

/** Aviso cuando la caja sigue abierta desde un día anterior (null si es de hoy). */
export function avisoCajaAbierta(diaTurno: string, hoy: string): string | null {
  if (diaTurno >= hoy) return null;
  const desde = diaTurno === sumarDias(hoy, -1) ? 'ayer' : `el ${formatearFecha(diaTurno)}`;
  return `La caja está abierta desde ${desde}. Ciérrala para empezar el día con cuentas claras.`;
}
