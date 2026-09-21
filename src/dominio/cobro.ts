import { calcularTotales, lineasParaVenta, type Carrito, type ConfigVentas } from './carrito';
import type { Centavos } from './dinero';
import type { Dispositivo, MetodoPago, Pago, RefUsuario, Turno, Venta } from './tipos';

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

const BILLETES: Centavos[] = [2000, 5000, 10000, 20000, 50000, 100000];

export function totalPagado(pagos: Pago[]): Centavos {
  return pagos.reduce((s, p) => s + p.monto, 0);
}

export function pendiente(total: Centavos, pagos: Pago[]): Centavos {
  return Math.max(0, total - totalPagado(pagos));
}

/** El cambio sale solo del efectivo: recibido − monto aplicado. */
export function cambio(pagos: Pago[]): Centavos {
  return pagos.reduce((s, p) => s + (p.metodo === 'efectivo' ? (p.recibido ?? p.monto) - p.monto : 0), 0);
}

/** La venta se confirma en cuanto el pendiente llega a cero. */
export function cobroCompleto(total: Centavos, pagos: Pago[]): boolean {
  return pendiente(total, pagos) === 0;
}

/** Hasta tres billetes comunes mayores al pendiente (el pago exacto tiene su propio botón). */
export function billetesSugeridos(porCobrar: Centavos): Centavos[] {
  return BILLETES.filter((b) => b > porCobrar).slice(0, 3);
}

export interface NuevoPago {
  metodo: MetodoPago;
  /** Efectivo: lo recibido. Tarjeta y transferencia: el monto a pagar. */
  monto: Centavos;
  referencia?: string;
  cuentaId?: string;
}

export type ResultadoPago = { ok: true; pagos: Pago[] } | { ok: false; error: string };

/**
 * Agrega un pago. Reglas: un pago por método, monto mayor a cero y solo el efectivo
 * puede exceder el pendiente (monto = min(recibido, pendiente); cambio = recibido − monto).
 */
export function agregarPago(
  total: Centavos,
  pagos: Pago[],
  nuevo: NuevoPago,
  opciones: { referenciaTransferenciaObligatoria?: boolean } = {},
): ResultadoPago {
  const porCobrar = pendiente(total, pagos);
  if (porCobrar === 0) return { ok: false, error: 'Ya no hay nada pendiente.' };
  if (pagos.some((p) => p.metodo === nuevo.metodo)) {
    return { ok: false, error: `Ya hay un pago con ${NOMBRE_METODO[nuevo.metodo].toLowerCase()}.` };
  }
  if (!Number.isSafeInteger(nuevo.monto) || nuevo.monto <= 0)
    return { ok: false, error: 'Escribe el monto.' };

  const referencia = nuevo.referencia?.trim() || undefined;
  if (nuevo.metodo === 'efectivo') {
    const monto = Math.min(nuevo.monto, porCobrar);
    return { ok: true, pagos: [...pagos, { metodo: 'efectivo', monto, recibido: nuevo.monto }] };
  }
  if (nuevo.monto > porCobrar) {
    return { ok: false, error: 'Solo el efectivo puede pasar del pendiente.' };
  }
  if (nuevo.metodo === 'transferencia' && opciones.referenciaTransferenciaObligatoria && !referencia) {
    return { ok: false, error: 'Escribe la referencia de la transferencia.' };
  }
  const pago: Pago = { metodo: nuevo.metodo, monto: nuevo.monto };
  if (referencia) pago.referencia = referencia;
  if (nuevo.cuentaId) pago.cuentaId = nuevo.cuentaId;
  return { ok: true, pagos: [...pagos, pago] };
}

export function quitarPago(pagos: Pago[], metodo: MetodoPago): Pago[] {
  return pagos.filter((p) => p.metodo !== metodo);
}

/** Venta lista para guardarse (el folio se asigna al guardarla, en la misma transacción). */
export type VentaNueva = Omit<Venta, 'folio' | 'folioNumero' | 'actualizadoEn'>;

/** Arma la venta con copia completa del carrito, totales, pagos y cambio. */
export function armarVenta(datos: {
  id: string;
  fecha: string;
  dia: string;
  carrito: Carrito;
  config: ConfigVentas;
  pagos: Pago[];
  turno: Pick<Turno, 'id'>;
  dispositivo: Pick<Dispositivo, 'id' | 'nombre'>;
  cajero: RefUsuario;
}): VentaNueva {
  const { carrito } = datos;
  const totales = calcularTotales(carrito.lineas, carrito.descuento, datos.config);
  if (!cobroCompleto(totales.total, datos.pagos)) throw new Error('Los pagos no cubren el total.');
  return {
    id: datos.id,
    dispositivoId: datos.dispositivo.id,
    dispositivoNombre: datos.dispositivo.nombre,
    turnoId: datos.turno.id,
    fecha: datos.fecha,
    dia: datos.dia,
    cajero: datos.cajero,
    cliente: carrito.cliente?.trim() || null,
    lineas: lineasParaVenta(carrito),
    subtotal: totales.subtotal,
    descuento:
      carrito.descuento && totales.descuento > 0
        ? { ...carrito.descuento, importe: totales.descuento }
        : null,
    iva: totales.iva,
    total: totales.total,
    pagos: datos.pagos,
    cambio: cambio(datos.pagos),
    estado: 'pagada',
    devuelto: 0,
    cancelacion: null,
  };
}
