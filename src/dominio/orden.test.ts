import { expect, test } from 'vitest';
import { mover, moverEn, siguienteOrden } from './orden.js';

const lista = [
  { id: 'a', orden: 1 },
  { id: 'b', orden: 2 },
  { id: 'c', orden: 3 },
];

test('mover sube o baja y renumera solo lo que cambia', () => {
  expect(mover(lista, 'c', -1)).toEqual([
    { id: 'c', orden: 2 },
    { id: 'b', orden: 3 },
  ]);
  expect(mover(lista, 'a', -1)).toEqual([]);
  expect(mover(lista, 'c', 1)).toEqual([]);
  expect(
    mover(
      [
        { id: 'x', orden: 5 },
        { id: 'y', orden: 9 },
      ],
      'x',
      1,
    ),
  ).toEqual([
    { id: 'y', orden: 1 },
    { id: 'x', orden: 2 },
  ]);
  expect(siguienteOrden(lista)).toBe(4);
  expect(siguienteOrden([])).toBe(1);
});

test('moverEn intercambia con el vecino y no se sale de la lista', () => {
  expect(moverEn(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  expect(moverEn(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
  expect(moverEn(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  expect(moverEn(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
});
