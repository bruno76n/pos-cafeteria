import { describe, expect, test } from 'vitest';
import { agregarLinea, carritoVacio, crearLinea } from './carrito';
import {
  agregarPago,
  armarVenta,
  billetesSugeridos,
  cambio,
  cobroCompleto,
  pendiente,
  quitarPago,
  totalPagado,
} from './cobro';
import { categoriaPrueba, configPrueba, productoPrueba } from './datosPrueba';
import type { Pago } from './tipos';

function pagar(total: number, ...nuevos: Parameters<typeof agregarPago>[2][]): Pago[] {
  return nuevos.reduce<Pago[]>((pagos, n) => {
    const r = agregarPago(total, pagos, n);
    if (!r.ok) throw new Error(r.error);
    return r.pagos;
  }, []);
}

describe('casos de la especificación', () => {
  test('D: total $193.50, efectivo $200 → cambio $6.50', () => {
    const pagos = pagar(19350, { metodo: 'efectivo', monto: 20000 });
    expect(pagos).toEqual([{ metodo: 'efectivo', monto: 19350, recibido: 20000 }]);
    expect(cambio(pagos)).toBe(650);
    expect(cobroCompleto(19350, pagos)).toBe(true);
  });

  test('E: $100 efectivo y luego $50 tarjeta', () => {
    let pagos = pagar(15000, { metodo: 'efectivo', monto: 10000 });
    expect(pendiente(15000, pagos)).toBe(5000);
    expect(cobroCompleto(15000, pagos)).toBe(false);
    pagos = pagar(15000, { metodo: 'efectivo', monto: 10000 }, { metodo: 'tarjeta', monto: 5000 });
    expect(pendiente(15000, pagos)).toBe(0);
    expect(cambio(pagos)).toBe(0);
    expect(totalPagado(pagos)).toBe(15000);
  });

  test('F: $100 tarjeta y luego efectivo $100 → aplica $50, cambio $50', () => {
    const pagos = pagar(15000, { metodo: 'tarjeta', monto: 10000 }, { metodo: 'efectivo', monto: 10000 });
    expect(pagos[1]).toEqual({ metodo: 'efectivo', monto: 5000, recibido: 10000 });
    expect(cambio(pagos)).toBe(5000);
    expect(totalPagado(pagos)).toBe(15000);
  });

  test('G: total en cero se confirma sin pagos', () => {
    expect(cobroCompleto(0, [])).toBe(true);
    expect(agregarPago(0, [], { metodo: 'efectivo', monto: 100 })).toEqual({
      ok: false,
      error: 'Ya no hay nada pendiente.',
    });
  });
});

describe('validaciones', () => {
  test('un pago por método', () => {
    const pagos = pagar(15000, { metodo: 'tarjeta', monto: 5000 });
    expect(agregarPago(15000, pagos, { metodo: 'tarjeta', monto: 1000 })).toEqual({
      ok: false,
      error: 'Ya hay un pago con tarjeta.',
    });
  });

  test('tarjeta y transferencia no exceden el pendiente', () => {
    expect(agregarPago(15000, [], { metodo: 'tarjeta', monto: 15001 })).toMatchObject({ ok: false });
    expect(agregarPago(15000, [], { metodo: 'transferencia', monto: 20000 })).toMatchObject({ ok: false });
  });

  test('monto en cero o inválido', () => {
    expect(agregarPago(15000, [], { metodo: 'efectivo', monto: 0 })).toMatchObject({ ok: false });
    expect(agregarPago(15000, [], { metodo: 'tarjeta', monto: 12.5 })).toMatchObject({ ok: false });
  });

  test('referencia obligatoria de transferencia', () => {
    const opciones = { referenciaTransferenciaObligatoria: true };
    expect(
      agregarPago(15000, [], { metodo: 'transferencia', monto: 15000, referencia: ' ' }, opciones),
    ).toEqual({
      ok: false,
      error: 'Escribe la referencia de la transferencia.',
    });
    const r = agregarPago(
      15000,
      [],
      { metodo: 'transferencia', monto: 15000, referencia: 'ABC123', cuentaId: 'c1' },
      opciones,
    );
    expect(r).toEqual({
      ok: true,
      pagos: [{ metodo: 'transferencia', monto: 15000, referencia: 'ABC123', cuentaId: 'c1' }],
    });
  });

  test('quitar un pago', () => {
    const pagos = pagar(15000, { metodo: 'tarjeta', monto: 5000 }, { metodo: 'efectivo', monto: 5000 });
    expect(quitarPago(pagos, 'tarjeta').map((p) => p.metodo)).toEqual(['efectivo']);
  });
});

describe('billetes sugeridos', () => {
  test('hasta tres billetes mayores al pendiente', () => {
    expect(billetesSugeridos(19350)).toEqual([20000, 50000, 100000]);
    expect(billetesSugeridos(8500)).toEqual([10000, 20000, 50000]);
    expect(billetesSugeridos(1500)).toEqual([2000, 5000, 10000]);
    expect(billetesSugeridos(10000)).toEqual([20000, 50000, 100000]);
    expect(billetesSugeridos(60000)).toEqual([100000]);
    expect(billetesSugeridos(150000)).toEqual([]);
  });
});

describe('armarVenta', () => {
  const brownie = productoPrueba('brownie');
  const carrito = {
    ...agregarLinea(
      carritoVacio(),
      crearLinea({
        producto: brownie,
        categoria: categoriaPrueba('postres'),
        grupos: [],
      }),
    ),
    cliente: ' Luis ',
    descuento: {
      tipo: 'porcentaje' as const,
      valor: 10,
      motivo: null,
      autorizadoPor: { id: 'e', nombre: 'Encargada' },
    },
  };
  const base = {
    id: 'v1',
    fecha: '2026-09-19T14:42:10.123Z',
    dia: '2026-09-19',
    carrito,
    config: configPrueba.ventas,
    turno: { id: 't1' },
    dispositivo: { id: 'd1', nombre: 'Caja 1' },
    cajero: { id: 'c', nombre: 'Cajero' },
  };

  test('copia el carrito, totales, pagos y cambio', () => {
    const v = armarVenta({ ...base, pagos: [{ metodo: 'efectivo', monto: 4050, recibido: 5000 }] });
    expect(v).toMatchObject({
      cliente: 'Luis',
      subtotal: 4500,
      total: 4050,
      cambio: 950,
      estado: 'pagada',
      devuelto: 0,
      cancelacion: null,
      turnoId: 't1',
      dispositivoNombre: 'Caja 1',
      descuento: {
        tipo: 'porcentaje',
        valor: 10,
        importe: 450,
        autorizadoPor: { id: 'e', nombre: 'Encargada' },
      },
    });
    expect(v.lineas[0]).toMatchObject({ nombre: 'Brownie', importe: 4500, categoriaNombre: 'Postres' });
    expect(v.lineas[0]).not.toHaveProperty('seleccion');
  });

  test('no arma una venta con pagos incompletos', () => {
    expect(() => armarVenta({ ...base, pagos: [{ metodo: 'tarjeta', monto: 100 }] })).toThrow();
  });

  test('total en cero sin pagos', () => {
    const gratis = {
      ...carrito,
      descuento: { tipo: 'monto' as const, valor: 6000, motivo: null, autorizadoPor: null },
    };
    const v = armarVenta({ ...base, carrito: gratis, pagos: [] });
    expect(v).toMatchObject({ total: 0, pagos: [], cambio: 0, descuento: { importe: 4500 } });
  });
});
