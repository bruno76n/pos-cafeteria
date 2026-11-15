import { describe, expect, test } from 'vitest';
import {
  consolidarLineas,
  estaAbierta,
  etiquetaComanda,
  avisoCuentasAbiertas,
  etiquetaCuenta,
  lineaDeAnulacion,
  ordenarPedidos,
  siguienteComanda,
  siguienteNumeroCuenta,
  subtotalDe,
  numeroDeCuenta,
} from './cuentas.js';
import { cuentaPrueba, pedidoPrueba, ventaPrueba } from './datosPrueba.js';
import type { LineaVenta } from './tipos.js';

const [latte, brownie] = ventaPrueba().lineas as [LineaVenta, LineaVenta];
const cafe: LineaVenta = {
  ...brownie,
  id: 'l-cafe',
  nombre: 'Café',
  precioUnitario: 4000,
  cantidad: 1,
  importe: 4000,
  nota: null,
};

describe('numeración', () => {
  test('la primera cuenta del día es la 1 y las demás siguen al mayor', () => {
    expect(siguienteNumeroCuenta([])).toBe(1);
    expect(siguienteNumeroCuenta([{ numero: 1 }, { numero: 2 }, { numero: 3 }])).toBe(4);
    // Un hueco (cuenta de otra tablet que aún no llega) no se reutiliza.
    expect(siguienteNumeroCuenta([{ numero: 1 }, { numero: 5 }])).toBe(6);
  });

  test('la siguiente comanda cuenta también las anulaciones', () => {
    expect(siguienteComanda([])).toBe(1);
    expect(siguienteComanda([{ numero: 1 }, { numero: 2 }])).toBe(3);
  });

  test('etiquetas de cuenta y de comanda', () => {
    expect(etiquetaCuenta(cuentaPrueba())).toBe('Cuenta 12 · Luis');
    expect(etiquetaCuenta(cuentaPrueba({ nombre: null }))).toBe('Cuenta 12');
    expect(numeroDeCuenta(cuentaPrueba())).toBe('Cuenta 12');
    expect(etiquetaComanda(2)).toBe('Comanda 2');
    expect(etiquetaComanda(2, 3)).toBe('Comanda 2 de 3');
  });
});

describe('estados', () => {
  test('solo una cuenta abierta se puede enviar, cobrar o cancelar', () => {
    expect(estaAbierta(cuentaPrueba())).toBe(true);
    expect(estaAbierta(cuentaPrueba({ estado: 'cobrada' }))).toBe(false);
    expect(estaAbierta(cuentaPrueba({ estado: 'cancelada' }))).toBe(false);
  });
});

describe('cierre de caja', () => {
  test('el aviso lista las cuentas abiertas y no impide cerrar', () => {
    expect(avisoCuentasAbiertas([])).toBeNull();
    expect(avisoCuentasAbiertas([cuentaPrueba()])).toBe(
      'Hay 1 cuenta abierta (Cuenta 12 · Luis). Se cobrará en el turno que esté abierto.',
    );
    expect(
      avisoCuentasAbiertas([cuentaPrueba({ numero: 3 }), cuentaPrueba({ numero: 4, nombre: null })]),
    ).toBe('Hay 2 cuentas abiertas (Cuenta 3 · Luis, Cuenta 4). Se cobrarán en el turno que esté abierto.');
  });
});

describe('consolidar pedidos', () => {
  const p1 = pedidoPrueba({ id: 'p1', numero: 1, lineas: [latte, brownie] });
  const p2 = pedidoPrueba({ id: 'p2', numero: 2, lineas: [cafe] });

  test('junta las líneas de todos los pedidos y recuerda su comanda', () => {
    const lineas = consolidarLineas([p2, p1]);
    expect(lineas.map((l) => [l.nombre, l.comanda])).toEqual([
      ['Latte', 1],
      ['Brownie', 1],
      ['Café', 2],
    ]);
    expect(subtotalDe(lineas)).toBe(17000 + 4500 + 4000);
  });

  test('una anulación resta piezas y deja el importe al precio unitario', () => {
    const anula = pedidoPrueba({
      id: 'p3',
      numero: 3,
      tipo: 'anulacion',
      lineas: [{ ...latte, cantidad: 1, importe: 8500 }],
    });
    const lineas = consolidarLineas([p1, p2, anula]);
    const l = lineas.find((x) => x.id === latte.id)!;
    expect(l).toMatchObject({ cantidad: 1, importe: 8500, comanda: 1 });
    expect(subtotalDe(lineas)).toBe(8500 + 4500 + 4000);
  });

  test('anular todas las piezas quita la línea', () => {
    const anula = pedidoPrueba({ id: 'p3', numero: 3, tipo: 'anulacion', lineas: [cafe] });
    const lineas = consolidarLineas([p1, p2, anula]);
    expect(lineas.map((l) => l.id)).toEqual([latte.id, brownie.id]);
  });

  test('no depende del orden en que llegan los pedidos', () => {
    const anula = pedidoPrueba({
      id: 'p3',
      numero: 3,
      tipo: 'anulacion',
      lineas: [{ ...latte, cantidad: 2, importe: 17000 }],
    });
    const a = consolidarLineas([p1, p2, anula]);
    const b = consolidarLineas([anula, p2, p1]);
    expect(b).toEqual(a);
    expect(a.map((l) => l.id)).toEqual([brownie.id, cafe.id]);
  });

  test('una anulación de más (cantidad mayor a la que hay) nunca deja negativos', () => {
    const anula = pedidoPrueba({
      id: 'p3',
      numero: 3,
      tipo: 'anulacion',
      lineas: [{ ...cafe, cantidad: 5, importe: 20000 }],
    });
    expect(consolidarLineas([p2, anula])).toEqual([]);
  });

  test('una cuenta sin pedidos no tiene líneas', () => {
    expect(consolidarLineas([])).toEqual([]);
  });

  test('ordena por número de comanda y, si empatan, por hora', () => {
    const a = { numero: 2, fecha: '2026-09-19T14:31:00.000Z' };
    const b = { numero: 2, fecha: '2026-09-19T14:30:00.000Z' };
    const c = { numero: 1, fecha: '2026-09-19T14:40:00.000Z' };
    expect(ordenarPedidos([a, b, c])).toEqual([c, b, a]);
  });
});

describe('anular una línea', () => {
  const vigentes = [latte, brownie];

  test('la línea de la anulación conserva el id y recalcula el importe', () => {
    expect(lineaDeAnulacion(vigentes, latte.id, 1)).toEqual({
      ok: true,
      linea: { ...latte, cantidad: 1, importe: 8500 },
    });
  });

  test('rechaza líneas que ya no están y cantidades imposibles', () => {
    expect(lineaDeAnulacion(vigentes, 'nada', 1)).toMatchObject({ ok: false });
    expect(lineaDeAnulacion(vigentes, latte.id, 0)).toMatchObject({ ok: false });
    expect(lineaDeAnulacion(vigentes, latte.id, 1.5)).toMatchObject({ ok: false });
    expect(lineaDeAnulacion(vigentes, latte.id, 3)).toEqual({
      ok: false,
      error: 'Solo quedan 2 en la cuenta.',
    });
  });
});
