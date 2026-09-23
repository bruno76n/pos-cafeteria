import { describe, expect, test } from 'vitest';
import { ventaPrueba } from './datosPrueba.js';
import { calcularReporte } from './reportes.js';
import type { Devolucion, Movimiento, Turno } from './tipos.js';

const ana = { id: 'cajero', nombre: 'Ana' };
const rangoDia = { desde: '2026-09-19', hasta: '2026-09-19' };

// 08:42 (caso B, $193.50), 10:15 (tarjeta $45), 12:00 cancelada ($60), y otra del día siguiente.
const ventas = [
  ventaPrueba(),
  ventaPrueba({
    id: 'v2',
    folio: 'A-000124',
    fecha: '2026-09-19T16:15:00.000Z',
    cajero: { id: 'e', nombre: 'Encargada' },
    lineas: [ventaPrueba().lineas[1]!],
    subtotal: 4500,
    descuento: null,
    total: 4500,
    pagos: [{ metodo: 'tarjeta', monto: 4500 }],
    cambio: 0,
  }),
  ventaPrueba({
    id: 'v3',
    folio: 'A-000125',
    fecha: '2026-09-19T18:00:00.000Z',
    total: 6000,
    estado: 'cancelada',
  }),
  ventaPrueba({ id: 'v4', folio: 'A-000126', fecha: '2026-09-20T16:00:00.000Z', dia: '2026-09-20' }),
];
const devolucion: Devolucion = {
  id: 'd',
  ventaId: 'venta-b',
  folioVenta: 'A-000123',
  turnoId: 't',
  dispositivoId: 'caja-1',
  lineas: [{ lineaId: 'l-brownie', cantidad: 1, importe: 4050 }],
  monto: 4050,
  metodo: 'efectivo',
  motivo: 'x',
  usuario: ana,
  autorizadoPor: null,
  fecha: '2026-09-19T20:00:00.000Z',
  dia: '2026-09-19',
  actualizadoEn: '2026-09-19T20:00:00.000Z',
};
const gasto: Movimiento = {
  id: 'g',
  turnoId: 't',
  dispositivoId: 'caja-1',
  tipo: 'gasto',
  categoria: 'Hielo',
  concepto: 'Bolsa',
  monto: 8000,
  usuario: ana,
  fecha: '2026-09-19T15:00:00.000Z',
  dia: '2026-09-19',
  anulado: false,
  actualizadoEn: '2026-09-19T15:00:00.000Z',
};
const corte = {
  id: 't',
  estado: 'cerrado',
  dia: '2026-09-19',
  cerradoEn: '2026-09-20T03:00:00.000Z', // 21:00 del 19 en CDMX
} as Turno;

describe('reporte de un día', () => {
  const r = calcularReporte(
    { ventas, movimientos: [gasto], devoluciones: [devolucion], turnos: [corte] },
    rangoDia,
  );

  test('resumen', () => {
    expect(r).toMatchObject({
      ventasBrutas: 19350 + 4500 + 6000,
      cancelaciones: { cantidad: 1, importe: 6000 },
      devoluciones: { cantidad: 1, importe: 4050 },
      ventasNetas: 19350 + 4500 - 4050,
      numeroVentas: 2,
      totalVendido: 23850,
      ticketPromedio: 11925,
      descuentos: 2150,
      porMetodo: { efectivo: 19350, tarjeta: 4500, transferencia: 0 },
      gastos: { total: 8000, porCategoria: { Hielo: 8000 } },
    });
  });

  test('barras por hora solo en el horario con ventas', () => {
    expect(r.barras.map((b) => [b.etiqueta, b.importe])).toEqual([
      ['08:00', 19350],
      ['09:00', 0],
      ['10:00', 4500],
    ]);
  });

  test('productos, categorías y cajeros', () => {
    expect(r.productos.map((p) => [p.nombre, p.cantidad, p.importe, p.porcentaje])).toEqual([
      ['Latte', 2, 17000, 65.4],
      ['Brownie', 2, 9000, 34.6],
    ]);
    expect(r.categorias.map((c) => [c.nombre, c.importe])).toEqual([
      ['Cafés', 17000],
      ['Postres', 9000],
    ]);
    expect(r.cajeros).toEqual([
      {
        usuarioId: 'cajero',
        nombre: 'Ana',
        ventas: 1,
        total: 19350,
        ticketPromedio: 19350,
        cancelaciones: 1,
      },
      { usuarioId: 'e', nombre: 'Encargada', ventas: 1, total: 4500, ticketPromedio: 4500, cancelaciones: 0 },
    ]);
    expect(r.cortes.map((t) => t.id)).toEqual(['t']);
  });
});

test('varios días: barras por día', () => {
  const r = calcularReporte(
    { ventas, movimientos: [], devoluciones: [], turnos: [] },
    { desde: '2026-09-18', hasta: '2026-09-20' },
  );
  expect(r.barras.map((b) => [b.etiqueta, b.ventas])).toEqual([
    ['2026-09-18', 0],
    ['2026-09-19', 2],
    ['2026-09-20', 1],
  ]);
  expect(r.numeroVentas).toBe(3);
});

test('rango sin ventas', () => {
  const r = calcularReporte({ ventas: [], movimientos: [], devoluciones: [], turnos: [] }, rangoDia);
  expect(r).toMatchObject({ totalVendido: 0, ticketPromedio: 0, barras: [], productos: [] });
});
