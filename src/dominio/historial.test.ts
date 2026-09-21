import { expect, test } from 'vitest';
import { ventaPrueba } from './datosPrueba';
import { cajerosDe, filtrarVentas, resumenProductos, SIN_FILTROS } from './historial';

const a = ventaPrueba({ id: 'a', folio: 'A-000123', fecha: '2026-09-19T14:00:00.000Z' });
const b = ventaPrueba({
  id: 'b',
  folio: 'B-000007',
  fecha: '2026-09-19T15:00:00.000Z',
  cajero: { id: 'e', nombre: 'Encargada' },
  pagos: [{ metodo: 'tarjeta', monto: 19350 }],
  estado: 'cancelada',
});

test('filtros de historial', () => {
  expect(filtrarVentas([a, b], SIN_FILTROS).map((v) => v.id)).toEqual(['b', 'a']);
  expect(filtrarVentas([a, b], { ...SIN_FILTROS, metodo: 'tarjeta' }).map((v) => v.id)).toEqual(['b']);
  expect(filtrarVentas([a, b], { ...SIN_FILTROS, cajeroId: 'cajero' }).map((v) => v.id)).toEqual(['a']);
  expect(filtrarVentas([a, b], { ...SIN_FILTROS, estado: 'cancelada' }).map((v) => v.id)).toEqual(['b']);
  expect(filtrarVentas([a, b], { ...SIN_FILTROS, folio: '123' }).map((v) => v.id)).toEqual(['a']);
  expect(filtrarVentas([a, b], { ...SIN_FILTROS, folio: 'b-0' }).map((v) => v.id)).toEqual(['b']);
});

test('resumen de productos y cajeros', () => {
  expect(resumenProductos(a)).toBe('2 Latte, 1 Brownie');
  expect(cajerosDe([a, b, a])).toEqual([
    { id: 'cajero', nombre: 'Ana' },
    { id: 'e', nombre: 'Encargada' },
  ]);
});
