import { describe, expect, test } from 'vitest';
import { categoriaPrueba, cuentaPrueba, pedidoPrueba, ventaPrueba } from './datosPrueba.js';
import { evaluarOperacion } from './reglasServidor.js';

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

  test('la línea conserva la copia del tamaño y de los ingredientes', () => {
    const [linea] = venta.lineas;
    const crepa = {
      ...linea!,
      tamano: { nombre: 'Grande', precio: 7500 },
      ingredientes: { nombres: ['Nutella', 'Fresa', 'Nuez'], incluidos: 2, extras: 1, precioExtra: 500 },
    };
    const r = evaluarOperacion({
      tabla: 'ventas',
      tipo: 'crear',
      registroId: venta.id,
      datos: { ...venta, lineas: [crepa] },
    });
    expect(r.ok && r.accion.tipo === 'insertar' && r.accion.valores.lineas).toEqual([crepa]);
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
      accion: { tipo: 'actualizar', soloAbierto: false },
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
      accion: { tipo: 'actualizar', soloAbierto: true },
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
  const cafes = categoriaPrueba('cafes');
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

  test('borrar categorías, grupos, ingredientes y productos; no usuarios', () => {
    for (const tabla of ['productos', 'ingredientes'] as const) {
      expect(
        evaluarOperacion({ tabla, tipo: 'borrar', registroId: 'p', datos: { actualizadoEn: ahora } }),
      ).toEqual({ ok: true, accion: { tipo: 'borrar', actualizadoEn: ahora } });
    }
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

describe('cuentas y pedidos', () => {
  const cuenta = cuentaPrueba();
  const pedido = pedidoPrueba();
  const op = (tabla: 'cuentasVenta' | 'pedidos', tipo: 'crear' | 'actualizar' | 'borrar', datos: object) =>
    evaluarOperacion({
      tabla,
      tipo,
      registroId: String((datos as { id?: string }).id ?? 'x'),
      datos: datos as never,
    });

  test('crear cuenta y pedido es insertar (idempotente)', () => {
    expect(op('cuentasVenta', 'crear', cuenta)).toMatchObject({ ok: true, accion: { tipo: 'insertar' } });
    expect(op('pedidos', 'crear', pedido)).toMatchObject({ ok: true, accion: { tipo: 'insertar' } });
  });

  test('una cuenta inválida o un pedido sin líneas se rechazan', () => {
    expect(op('cuentasVenta', 'crear', { ...cuenta, estado: 'pagada' }).ok).toBe(false);
    expect(op('pedidos', 'crear', { ...pedido, lineas: [] }).ok).toBe(false);
  });

  test('la cuenta cambia solo estado, nombre, ventaId y cancelacion, y solo mientras está abierta', () => {
    const cobrada = { id: cuenta.id, estado: 'cobrada', ventaId: 'v1', actualizadoEn: ahora };
    expect(op('cuentasVenta', 'actualizar', cobrada)).toMatchObject({
      ok: true,
      accion: { tipo: 'actualizar', soloAbierto: true },
    });
    expect(op('cuentasVenta', 'actualizar', { id: cuenta.id, nombre: 'Luis', actualizadoEn: ahora }).ok).toBe(
      true,
    );
    const cancelada = {
      id: cuenta.id,
      estado: 'cancelada',
      cancelacion: { motivo: 'Se fue', usuario: ana, autorizadoPor: null, fecha: ahora },
      actualizadoEn: ahora,
    };
    expect(op('cuentasVenta', 'actualizar', cancelada).ok).toBe(true);
    for (const campo of [{ numero: 3 }, { turnoId: 't9' }, { dia: '2026-01-01' }, { abiertaPor: ana }]) {
      expect(op('cuentasVenta', 'actualizar', { id: cuenta.id, ...campo, actualizadoEn: ahora }).ok).toBe(
        false,
      );
    }
  });

  test('los pedidos no se modifican ni se borran, y las cuentas tampoco se borran', () => {
    expect(op('pedidos', 'actualizar', { id: pedido.id, numero: 2, actualizadoEn: ahora })).toEqual({
      ok: false,
      motivo: 'No se puede modificar un registro de pedidos.',
    });
    expect(op('pedidos', 'borrar', { id: pedido.id, actualizadoEn: ahora }).ok).toBe(false);
    expect(op('cuentasVenta', 'borrar', { id: cuenta.id, actualizadoEn: ahora }).ok).toBe(false);
  });

  test('crear una venta con cuenta es tolerante con los datos de la cuenta', () => {
    const conCuenta = { ...venta, cuentaId: 'cuenta-1', cuentaNumero: 12, cuentaComandas: 2 };
    expect(
      evaluarOperacion({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: conCuenta }),
    ).toMatchObject({
      ok: true,
      accion: { valores: { cuentaId: 'cuenta-1', cuentaNumero: 12, cuentaComandas: 2 } },
    });
    const rara = { ...venta, cuentaNumero: 'doce' };
    expect(evaluarOperacion({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: rara }).ok).toBe(
      true,
    );
  });
});
