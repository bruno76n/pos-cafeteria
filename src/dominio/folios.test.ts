import { describe, expect, test } from 'vitest';
import {
  contadorInicial,
  esPrefijoValido,
  formatearFolio,
  leerFolio,
  prefijoEnUso,
  siguienteFolio,
} from './folios.js';

describe('folios', () => {
  test('formato A-000123', () => {
    expect(formatearFolio('A', 123)).toBe('A-000123');
    expect(formatearFolio('B', 1234567)).toBe('B-1234567');
    expect(leerFolio('A-000123')).toEqual({ prefijo: 'A', numero: 123 });
    expect(leerFolio('123')).toBeNull();
  });
  test('siguiente folio', () => {
    expect(siguienteFolio({ prefijo: 'A', ultimoFolio: 0 })).toEqual({ folio: 'A-000001', numero: 1 });
    expect(siguienteFolio({ prefijo: 'C', ultimoFolio: 41 })).toEqual({ folio: 'C-000042', numero: 42 });
    expect(() => siguienteFolio({ prefijo: null, ultimoFolio: 0 })).toThrow();
  });
  test('contador inicial toma el mayor', () => {
    expect(contadorInicial('A', 10, ['A-000012', 'B-000099', 'A-000003'])).toBe(12);
    expect(contadorInicial('A', 20, ['A-000012'])).toBe(20);
    expect(contadorInicial('A', 0, [])).toBe(0);
  });
  test('prefijos', () => {
    expect(esPrefijoValido('A')).toBe(true);
    expect(esPrefijoValido('a')).toBe(false);
    expect(esPrefijoValido('AB')).toBe(false);
    const otros = [
      { id: 'd1', nombre: 'Caja 1', prefijo: 'A' },
      { id: 'd2', nombre: 'Caja 2', prefijo: 'B' },
    ];
    expect(prefijoEnUso('A', otros, 'd3')?.nombre).toBe('Caja 1');
    expect(prefijoEnUso('A', otros, 'd1')).toBeUndefined();
    expect(prefijoEnUso('C', otros, 'd3')).toBeUndefined();
  });
});
