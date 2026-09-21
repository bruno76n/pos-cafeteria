import { describe, expect, test } from 'vitest';
import { DENOMINACIONES, resumirTurno, tipoDiferencia, totalConteo } from './caja';
import { ventaPrueba } from './datosPrueba';
import type { Devolucion, Movimiento, Venta } from './tipos';

const ana = { id: 'cajero', nombre: 'Ana' };
const turno = { id: 'turno-1', fondoInicial: 50000 };

function venta(id: string, total: number, pagos: Venta['pagos'], cambios: Partial<Venta> = {}): Venta {
  return ventaPrueba({
    id,
    folio: `A-00000${id}`,
    total,
    subtotal: total,
    descuento: null,
    pagos,
    ...cambios,
  });
}

function movimiento(tipo: Movimiento['tipo'], monto: number, cambios: Partial<Movimiento> = {}): Movimiento {
  return {
    id: `${tipo}-${monto}`,
    turnoId: 'turno-1',
    dispositivoId: 'caja-1',
    tipo,
    categoria: tipo === 'gasto' ? 'Hielo' : null,
    concepto: tipo,
    monto,
    usuario: ana,
    fecha: '2026-09-19T15:00:00.000Z',
    dia: '2026-09-19',
    anulado: false,
    actualizadoEn: '2026-09-19T15:00:00.000Z',
    ...cambios,
  };
}

const devolucionEfectivo: Devolucion = {
  id: 'dev-1',
  ventaId: '9',
  folioVenta: 'A-000009',
  turnoId: 'turno-1',
  dispositivoId: 'caja-1',
  lineas: [{ lineaId: 'l-brownie', cantidad: 1, importe: 4500 }],
  monto: 4500,
  metodo: 'efectivo',
  motivo: 'Frío',
  usuario: ana,
  autorizadoPor: null,
  fecha: '2026-09-19T16:00:00.000Z',
  dia: '2026-09-19',
  actualizadoEn: '2026-09-19T16:00:00.000Z',
};

describe('caso H', () => {
  test('fondo $500, ventas $1,250 en efectivo, movimientos y devolución: esperado $1,525, faltan $15', () => {
    const ventas = [
      venta('1', 100000, [{ metodo: 'efectivo', monto: 100000, recibido: 100000 }]),
      venta('2', 25000, [{ metodo: 'efectivo', monto: 25000, recibido: 50000 }]),
      venta('3', 30000, [{ metodo: 'tarjeta', monto: 30000 }]),
      venta('4', 8000, [{ metodo: 'efectivo', monto: 8000 }], {
        estado: 'cancelada',
        cancelacion: {
          motivo: 'Error',
          usuario: ana,
          autorizadoPor: null,
          fecha: '2026-09-19T15:30:00.000Z',
        },
      }),
      venta('5', 9999, [{ metodo: 'efectivo', monto: 9999 }], { turnoId: 'otro-turno' }),
    ];
    const movimientos = [
      movimiento('entrada', 20000),
      movimiento('retiro', 30000),
      movimiento('gasto', 8000),
      movimiento('gasto', 7000, { id: 'anulado', anulado: true }),
    ];
    const r = resumirTurno({
      turno,
      ventas,
      movimientos,
      devoluciones: [devolucionEfectivo],
      contado: 151000,
    });

    expect(r.efectivoEsperado).toBe(152500);
    expect(r.diferencia).toBe(-1500);
    expect(tipoDiferencia(r.diferencia!)).toBe('faltante');
    expect(r.ventas).toBe(3);
    expect(r.totalVendido).toBe(155000);
    expect(r.porMetodo).toEqual({ efectivo: 125000, tarjeta: 30000, transferencia: 0 });
    expect(r.cancelaciones).toEqual({ cantidad: 1, importe: 8000 });
    expect(r.devoluciones).toEqual({ cantidad: 1, importe: 4500, efectivo: 4500 });
    expect(r.entradas).toBe(20000);
    expect(r.retiros).toBe(30000);
    expect(r.gastos).toEqual({ total: 8000, porCategoria: { Hielo: 8000 } });
  });
});

describe('resumen', () => {
  test('sin conteo no hay diferencia', () => {
    const r = resumirTurno({ turno, ventas: [], movimientos: [], devoluciones: [] });
    expect(r.efectivoEsperado).toBe(50000);
    expect(r.efectivoContado).toBeNull();
    expect(r.diferencia).toBeNull();
  });

  test('agrega por producto, categoría y cajero', () => {
    const r = resumirTurno({
      turno,
      ventas: [ventaPrueba(), ventaPrueba({ id: 'otra' })],
      movimientos: [],
      devoluciones: [],
    });
    expect(r.porProducto.map((p) => [p.nombre, p.cantidad, p.importe])).toEqual([
      ['Latte', 4, 34000],
      ['Brownie', 2, 9000],
    ]);
    expect(r.porCategoria.map((c) => [c.nombre, c.importe])).toEqual([
      ['Cafés', 34000],
      ['Postres', 9000],
    ]);
    expect(r.porCajero).toEqual([
      { usuarioId: 'cajero', nombre: 'Ana', ventas: 2, cantidad: 6, importe: 38700 },
    ]);
    expect(r.descuentos).toBe(4300);
  });

  test('devoluciones con tarjeta no restan efectivo', () => {
    const r = resumirTurno({
      turno,
      ventas: [],
      movimientos: [],
      devoluciones: [{ ...devolucionEfectivo, metodo: 'tarjeta' }],
    });
    expect(r.efectivoEsperado).toBe(50000);
    expect(r.devoluciones.efectivo).toBe(0);
  });

  test('diferencia exacta y sobrante', () => {
    expect(tipoDiferencia(0)).toBe('exacto');
    expect(tipoDiferencia(2000)).toBe('sobrante');
  });
});

describe('conteo por denominaciones', () => {
  test('suma billetes y monedas', () => {
    expect(totalConteo({ b1000: 1, b500: 1, m050: 3, m20: 2 })).toBe(100000 + 50000 + 150 + 4000);
    expect(totalConteo({})).toBe(0);
    expect(new Set(DENOMINACIONES.map((d) => d.clave)).size).toBe(DENOMINACIONES.length);
  });
});
