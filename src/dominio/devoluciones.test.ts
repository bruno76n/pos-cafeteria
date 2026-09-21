import { describe, expect, test } from 'vitest';
import { ventaPrueba } from './datosPrueba';
import {
  aplicarDevolucion,
  calcularReembolso,
  devolverTodo,
  puedeCancelar,
  puedeDevolver,
} from './devoluciones';

const ventaB = ventaPrueba();

describe('caso I', () => {
  test('devolver 1 Brownie de la venta B reembolsa $40.50', () => {
    const r = calcularReembolso(ventaB, [{ lineaId: 'l-brownie', cantidad: 1 }]);
    expect(r).toEqual({
      ok: true,
      lineas: [{ lineaId: 'l-brownie', cantidad: 1, importe: 4050 }],
      monto: 4050,
    });
    if (!r.ok) return;
    expect(aplicarDevolucion(ventaB, r)).toEqual({ estado: 'devuelta_parcial', devuelto: 4050 });
  });
});

describe('reembolsos', () => {
  test('devolver todo reembolsa el total exacto', () => {
    const r = calcularReembolso(ventaB, devolverTodo(ventaB));
    expect(r.ok && r.monto).toBe(19350);
    expect(r.ok && r.lineas.reduce((s, l) => s + l.importe, 0)).toBe(19350);
    if (r.ok) expect(aplicarDevolucion(ventaB, r).estado).toBe('devuelta');
  });

  test('devoluciones sucesivas no pasan del total', () => {
    const primera = calcularReembolso(ventaB, [{ lineaId: 'l-latte', cantidad: 1 }]);
    expect(primera.ok && primera.monto).toBe(7650);
    if (!primera.ok) return;
    const tras = aplicarDevolucion(ventaB, primera);
    const venta2 = { ...ventaB, ...tras };
    const resto = devolverTodo(venta2, [primera]);
    expect(resto).toEqual([
      { lineaId: 'l-latte', cantidad: 1 },
      { lineaId: 'l-brownie', cantidad: 1 },
    ]);
    const segunda = calcularReembolso(venta2, resto, [primera]);
    expect(segunda.ok && segunda.monto).toBe(19350 - 7650);
    if (segunda.ok)
      expect(aplicarDevolucion(venta2, segunda, [primera])).toEqual({ estado: 'devuelta', devuelto: 19350 });
  });

  test('no se devuelve más de lo vendido', () => {
    expect(calcularReembolso(ventaB, [{ lineaId: 'l-brownie', cantidad: 2 }])).toEqual({
      ok: false,
      error: 'Solo quedan 1 de Brownie por devolver.',
    });
    const previa = { lineas: [{ lineaId: 'l-brownie', cantidad: 1, importe: 4050 }] };
    expect(calcularReembolso(ventaB, [{ lineaId: 'l-brownie', cantidad: 1 }], [previa]).ok).toBe(false);
    expect(calcularReembolso(ventaB, []).ok).toBe(false);
    expect(calcularReembolso(ventaB, [{ lineaId: 'no-existe', cantidad: 1 }]).ok).toBe(false);
  });

  test('venta sin descuento reembolsa el importe completo', () => {
    const v = ventaPrueba({ descuento: null, total: 21500 });
    const r = calcularReembolso(v, [{ lineaId: 'l-brownie', cantidad: 1 }]);
    expect(r.ok && r.monto).toBe(4500);
  });
});

describe('qué se puede hacer con una venta', () => {
  test('cancelar solo pagadas con su turno abierto', () => {
    expect(puedeCancelar(ventaB, { estado: 'abierto' })).toBe(true);
    expect(puedeCancelar(ventaB, { estado: 'cerrado' })).toBe(false);
    expect(puedeCancelar(ventaB, undefined)).toBe(false);
    expect(puedeCancelar({ ...ventaB, estado: 'devuelta_parcial' }, { estado: 'abierto' })).toBe(false);
  });
  test('devolver pagadas o devueltas parcialmente', () => {
    expect(puedeDevolver(ventaB)).toBe(true);
    expect(puedeDevolver({ ...ventaB, estado: 'devuelta_parcial' })).toBe(true);
    expect(puedeDevolver({ ...ventaB, estado: 'devuelta' })).toBe(false);
    expect(puedeDevolver({ ...ventaB, estado: 'cancelada' })).toBe(false);
  });
});
