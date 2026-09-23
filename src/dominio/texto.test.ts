import { expect, test } from 'vitest';
import { coincide, normalizarBusqueda } from './texto.js';

test('busca sin acentos ni mayúsculas', () => {
  expect(normalizarBusqueda('  Frappé de CAFÉ ')).toBe('frappe de cafe');
  expect(coincide('Té de la casa', 'te')).toBe(true);
  expect(coincide('Sándwich de pavo', 'SANDW')).toBe(true);
  expect(coincide('Piña colada', 'pina')).toBe(true);
  expect(coincide('Latte', 'moka')).toBe(false);
});
