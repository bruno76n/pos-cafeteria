import { expect, test } from 'vitest';
import { mover, siguienteOrden } from './orden';

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
