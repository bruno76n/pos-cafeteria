import { expect, test } from 'vitest';
import type { TrabajoImpresion } from './comanda';
import { ErrorImpresion, MENSAJES_IMPRESORA as M } from './drivers';
import { falloDeTrabajos } from './usarImpresora';

const doc = { columnas: 32 as const, lineas: [] };
const ambos: TrabajoImpresion[] = [
  { tipo: 'comanda', doc },
  { tipo: 'ticket', doc },
];
const perdida = new ErrorImpresion(M.conexionPerdida);

test('si falla solo la comanda, el error dice cuál', () => {
  expect(falloDeTrabajos(ambos, [{ tipo: 'comanda', error: perdida }])).toEqual({
    mensaje: M.comanda,
    ayuda: M.conexionPerdida,
    fallidos: ['comanda'],
  });
});

test('si falla solo el ticket, el error dice cuál', () => {
  expect(falloDeTrabajos(ambos, [{ tipo: 'ticket', error: perdida }])?.mensaje).toBe(M.ticketCliente);
});

test('si no sale nada, el error de la impresora', () => {
  const fallo = falloDeTrabajos(ambos, [
    { tipo: 'comanda', error: perdida },
    { tipo: 'ticket', error: perdida },
  ]);
  expect(fallo).toEqual({ mensaje: M.conexionPerdida, fallidos: ['comanda', 'ticket'] });
});

test('reimprimir solo la comanda que falla lo dice; sin errores no hay fallo', () => {
  expect(
    falloDeTrabajos([{ tipo: 'comanda', doc }], [{ tipo: 'comanda', error: new Error('x') }]),
  ).toMatchObject({
    mensaje: M.comanda,
    ayuda: M.noResponde,
  });
  expect(falloDeTrabajos(ambos, [])).toBeNull();
});
