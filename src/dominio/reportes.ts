import {
  agregarPorCategoria,
  agregarPorProducto,
  montoPorMetodo,
  sumarMovimientos,
  ventaCuenta,
} from './caja';
import { redondear, type Centavos } from './dinero';
import { diaLocal, diasDelRango, horaLocal, type RangoDias } from './fechas';
import type { Devolucion, MetodoPago, Movimiento, Turno, Venta } from './tipos';

// Reportes con funciones puras: sirven igual con los datos de la tablet (35 días) o con los que
// regresa GET /api/reportes para rangos más largos.

export interface DatosReporte {
  ventas: Venta[];
  movimientos: Movimiento[];
  devoluciones: Devolucion[];
  turnos: Turno[];
}

export interface Barra {
  etiqueta: string;
  importe: Centavos;
  ventas: number;
}

export interface Reporte {
  /** Todo lo vendido, incluidas las ventas canceladas. */
  ventasBrutas: Centavos;
  cancelaciones: { cantidad: number; importe: Centavos };
  devoluciones: { cantidad: number; importe: Centavos };
  /** Brutas − cancelaciones − devoluciones. */
  ventasNetas: Centavos;
  /** Ventas no canceladas. */
  numeroVentas: number;
  /** Suma de las ventas no canceladas. */
  totalVendido: Centavos;
  ticketPromedio: Centavos;
  descuentos: Centavos;
  porMetodo: Record<MetodoPago, Centavos>;
  gastos: { total: Centavos; porCategoria: Record<string, Centavos> };
  /** Por hora si el rango es de un día; por día si es más largo. */
  barras: Barra[];
  productos: (ReturnType<typeof agregarPorProducto>[number] & { porcentaje: number })[];
  categorias: (ReturnType<typeof agregarPorCategoria>[number] & { porcentaje: number })[];
  cajeros: {
    usuarioId: string;
    nombre: string;
    ventas: number;
    total: Centavos;
    ticketPromedio: Centavos;
    cancelaciones: number;
  }[];
  cortes: Turno[];
}

const enRango = (dia: string, r: RangoDias) => dia >= r.desde && dia <= r.hasta;
const porcentaje = (parte: number, total: number) =>
  total === 0 ? 0 : Math.round((parte * 1000) / total) / 10;

export function calcularReporte(datos: DatosReporte, rango: RangoDias): Reporte {
  const ventas = datos.ventas.filter((v) => enRango(v.dia, rango));
  const vigentes = ventas.filter(ventaCuenta);
  const canceladas = ventas.filter((v) => !ventaCuenta(v));
  const devoluciones = datos.devoluciones.filter((d) => enRango(d.dia, rango));
  const movimientos = sumarMovimientos(datos.movimientos.filter((m) => enRango(m.dia, rango)));

  const totalVendido = vigentes.reduce((s, v) => s + v.total, 0);
  const importeCancelado = canceladas.reduce((s, v) => s + v.total, 0);
  const importeDevuelto = devoluciones.reduce((s, d) => s + d.monto, 0);
  const ventasBrutas = totalVendido + importeCancelado;

  const unDia = rango.desde === rango.hasta;
  const barras: Barra[] = unDia
    ? Array.from({ length: 24 }, (_, h) => ({
        etiqueta: `${String(h).padStart(2, '0')}:00`,
        importe: 0,
        ventas: 0,
      }))
    : diasDelRango(rango).map((d) => ({ etiqueta: d, importe: 0, ventas: 0 }));
  for (const v of vigentes) {
    const barra = unDia ? barras[horaLocal(v.fecha)] : barras.find((b) => b.etiqueta === v.dia);
    if (barra) {
      barra.importe += v.total;
      barra.ventas += 1;
    }
  }
  // En un día, solo el horario con movimiento (de la primera a la última hora con ventas).
  const conVentas = barras.map((b, i) => (b.ventas ? i : -1)).filter((i) => i >= 0);
  const barrasVisibles =
    unDia && conVentas.length ? barras.slice(conVentas[0], conVentas.at(-1)! + 1) : unDia ? [] : barras;

  const productos = agregarPorProducto(vigentes);
  const totalProductos = productos.reduce((s, p) => s + p.importe, 0);
  const categorias = agregarPorCategoria(vigentes);

  const cajeros = new Map<string, Reporte['cajeros'][number]>();
  for (const v of ventas) {
    const c = cajeros.get(v.cajero.id) ?? {
      usuarioId: v.cajero.id,
      nombre: v.cajero.nombre,
      ventas: 0,
      total: 0,
      ticketPromedio: 0,
      cancelaciones: 0,
    };
    if (ventaCuenta(v)) {
      c.ventas += 1;
      c.total += v.total;
    } else {
      c.cancelaciones += 1;
    }
    cajeros.set(v.cajero.id, c);
  }

  return {
    ventasBrutas,
    cancelaciones: { cantidad: canceladas.length, importe: importeCancelado },
    devoluciones: { cantidad: devoluciones.length, importe: importeDevuelto },
    ventasNetas: ventasBrutas - importeCancelado - importeDevuelto,
    numeroVentas: vigentes.length,
    totalVendido,
    ticketPromedio: vigentes.length ? redondear(totalVendido / vigentes.length) : 0,
    descuentos: vigentes.reduce((s, v) => s + (v.descuento?.importe ?? 0), 0),
    porMetodo: montoPorMetodo(vigentes),
    gastos: movimientos.gastos,
    barras: barrasVisibles,
    productos: productos.map((p) => ({ ...p, porcentaje: porcentaje(p.importe, totalProductos) })),
    categorias: categorias.map((c) => ({ ...c, porcentaje: porcentaje(c.importe, totalProductos) })),
    cajeros: [...cajeros.values()]
      .map((c) => ({ ...c, ticketPromedio: c.ventas ? redondear(c.total / c.ventas) : 0 }))
      .sort((a, b) => b.total - a.total),
    cortes: datos.turnos
      .filter((t) => t.estado === 'cerrado' && t.cerradoEn && enRango(diaLocal(t.cerradoEn), rango))
      .sort((a, b) => (b.cerradoEn ?? '').localeCompare(a.cerradoEn ?? '')),
  };
}
