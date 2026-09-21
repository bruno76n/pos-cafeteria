import { describe, expect, test } from 'vitest';
import { categoriasPrueba, ventaPrueba } from './datosPrueba';
import { evaluarOperacion } from './reglasServidor';

const ahora = '2026-09-19T15:00:00.000Z';
const ana = { id: 'u1', nombre: 'Ana' };
const venta = ventaPrueba();

const turno = {
  id: 't1',
  dispositivoId: 'd1',
  dispositivoNombre: 'Caja 1',
  estado: 'abierto',
  abiertoPor: ana,
  abiertoEn: ahora,
  dia: '2026-09-19',
  fondoInicial: 50000,
  actualizadoEn: ahora,
};

describe('ventas', () => {
  test('crear una venta completa', () => {
    const r = evaluarOperacion({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta });
    expect(r).toMatchObject({ ok: true, accion: { tipo: 'insertar' } });
  });

  test('crear es tolerante con datos raros', () => {
    const rara = {
      ...venta,
      cliente: 42,
      estado: 'rara',
      lineas: [{ importe: 100, cantidad: 1, extra: true }],
      cambio: 'x',
    };
    const r = evaluarOperacion({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: rara });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.accion).toMatchObject({ valores: { cliente: null, estado: 'pagada', cambio: 0 } });
  });

  test('crear sin lo indispensable se rechaza', () => {
    const { total: _, ...sinTotal } = venta;
    expect(
      evaluarOperacion({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: sinTotal }).ok,
    ).toBe(false);
  });

  test('actualizar solo estado, cancelación y devuelto', () => {
    const cancelar = {
      estado: 'cancelada',
      cancelacion: { motivo: 'Error', usuario: ana, autorizadoPor: null, fecha: ahora },
      actualizadoEn: ahora,
    };
    expect(
      evaluarOperacion({ tabla: 'ventas', tipo: 'actualizar', registroId: venta.id, datos: cancelar }),
    ).toMatchObject({
      ok: true,
      accion: { tipo: 'actualizar', soloTurnoAbierto: false },
    });
    expect(
      evaluarOperacion({
        tabla: 'ventas',
        tipo: 'actualizar',
        registroId: venta.id,
        datos: { total: 1, actualizadoEn: ahora },
      }),
    ).toEqual({ ok: false, motivo: 'No se puede cambiar el campo total en ventas.' });
  });

  test('borrar una venta se rechaza', () => {
    expect(
      evaluarOperacion({
        tabla: 'ventas',
        tipo: 'borrar',
        registroId: venta.id,
        datos: { actualizadoEn: ahora },
      }),
    ).toEqual({
      ok: false,
      motivo: 'No se puede borrar en ventas.',
    });
  });

  test('el id de los datos debe coincidir', () => {
    expect(evaluarOperacion({ tabla: 'ventas', tipo: 'crear', registroId: 'otro', datos: venta }).ok).toBe(
      false,
    );
  });
});

describe('movimientos, devoluciones y turnos', () => {
  test('movimiento: solo anular', () => {
    const anular = { anulado: true, anuladoPor: ana, anuladoEn: ahora, actualizadoEn: ahora };
    expect(
      evaluarOperacion({ tabla: 'movimientos', tipo: 'actualizar', registroId: 'm', datos: anular }).ok,
    ).toBe(true);
    expect(
      evaluarOperacion({
        tabla: 'movimientos',
        tipo: 'actualizar',
        registroId: 'm',
        datos: { monto: 1, actualizadoEn: ahora },
      }).ok,
    ).toBe(false);
  });

  test('devoluciones no se modifican', () => {
    expect(
      evaluarOperacion({
        tabla: 'devoluciones',
        tipo: 'actualizar',
        registroId: 'd',
        datos: { monto: 1, actualizadoEn: ahora },
      }),
    ).toEqual({ ok: false, motivo: 'No se puede modificar un registro de devoluciones.' });
  });

  test('turno: crear y cerrar (solo si sigue abierto)', () => {
    expect(
      evaluarOperacion({ tabla: 'turnos', tipo: 'crear', registroId: 't1', datos: turno }),
    ).toMatchObject({ ok: true });
    const cerrar = {
      estado: 'cerrado',
      cerradoPor: ana,
      cerradoEn: ahora,
      efectivoContado: 50000,
      actualizadoEn: ahora,
    };
    expect(
      evaluarOperacion({ tabla: 'turnos', tipo: 'actualizar', registroId: 't1', datos: cerrar }),
    ).toMatchObject({
      ok: true,
      accion: { tipo: 'actualizar', soloTurnoAbierto: true },
    });
    expect(
      evaluarOperacion({
        tabla: 'turnos',
        tipo: 'actualizar',
        registroId: 't1',
        datos: { dispositivoId: 'otro', actualizadoEn: ahora },
      }).ok,
    ).toBe(false);
  });
});

describe('catálogo y configuración', () => {
  const cafes = categoriasPrueba[0]!;
  test('crear y actualizar son upsert con el registro completo', () => {
    expect(
      evaluarOperacion({ tabla: 'categorias', tipo: 'crear', registroId: cafes.id, datos: cafes }),
    ).toMatchObject({
      ok: true,
      accion: { tipo: 'upsert' },
    });
    expect(
      evaluarOperacion({
        tabla: 'categorias',
        tipo: 'actualizar',
        registroId: cafes.id,
        datos: { nombre: 'X' },
      }).ok,
    ).toBe(false);
  });

  test('borrar categorías, grupos y productos; no usuarios', () => {
    expect(
      evaluarOperacion({
        tabla: 'productos',
        tipo: 'borrar',
        registroId: 'p',
        datos: { actualizadoEn: ahora },
      }),
    ).toEqual({
      ok: true,
      accion: { tipo: 'borrar', actualizadoEn: ahora },
    });
    expect(
      evaluarOperacion({
        tabla: 'usuarios',
        tipo: 'borrar',
        registroId: 'u',
        datos: { actualizadoEn: ahora },
      }).ok,
    ).toBe(false);
  });
});
