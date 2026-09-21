import { describe, expect, test } from 'vitest';
import {
  aTextoCaptura,
  esCentavos,
  formatearDinero,
  formatearDineroCorto,
  leerCaptura,
  pesos,
  redondear,
} from './dinero';

describe('redondear', () => {
  test('mitades hacia arriba', () => {
    expect(redondear(2.5)).toBe(3);
    expect(redondear(2.4999)).toBe(2);
    expect(redondear(16681.034)).toBe(16681);
    expect(redondear(-2.5)).toBe(-3);
  });
  test('tolera el ruido de punto flotante', () => {
    expect(redondear(1.005 * 1000)).toBe(1005);
    expect(redondear(0.1 * 3 * 10)).toBe(3);
  });
});

describe('formato MXN', () => {
  test('centavos a pesos', () => {
    expect(formatearDinero(19350)).toBe('$193.50');
    expect(formatearDinero(0)).toBe('$0.00');
    expect(formatearDinero(123456)).toBe('$1,234.56');
    expect(formatearDinero(-2150)).toBe('-$21.50');
    expect(formatearDinero(-0)).toBe('$0.00');
  });
  test('corto sin decimales cuando son pesos cerrados', () => {
    expect(formatearDineroCorto(20000)).toBe('$200');
    expect(formatearDineroCorto(100000)).toBe('$1,000');
    expect(formatearDineroCorto(1250)).toBe('$12.50');
  });
  test('pesos() convierte a centavos', () => {
    expect(pesos(65)).toBe(6500);
    expect(pesos(0.1 + 0.2)).toBe(30);
  });
});

describe('leerCaptura', () => {
  test.each([
    ['12.5', 1250],
    ['12', 1200],
    ['0.50', 50],
    ['.5', 50],
    ['$1,200', 120000],
    [' 200.05 ', 20005],
    ['12.', 1200],
  ])('%s → %i', (texto, esperado) => {
    expect(leerCaptura(texto)).toBe(esperado);
  });
  test.each(['', 'abc', '-5', '12.555', '1.2.3'])('"%s" no es válido', (texto) => {
    expect(leerCaptura(texto)).toBeNull();
  });
  test('ida y vuelta con aTextoCaptura', () => {
    expect(aTextoCaptura(1250)).toBe('12.50');
    expect(aTextoCaptura(1200)).toBe('12');
    expect(leerCaptura(aTextoCaptura(19350))).toBe(19350);
  });
  test('esCentavos', () => {
    expect(esCentavos(100)).toBe(true);
    expect(esCentavos(1.5)).toBe(false);
    expect(esCentavos('1')).toBe(false);
  });
});
