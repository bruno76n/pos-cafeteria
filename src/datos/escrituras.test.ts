import { beforeEach, describe, expect, test } from 'vitest';
import { categoriaPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import type { VentaNueva } from '@/dominio/cobro';
import { verificarPin } from '@/dominio/pin';
import { bd, leerMeta } from './bd';
import {
  actualizar,
  alEscribir,
  abrirTurno,
  anularMovimiento,
  cancelarVenta,
  cerrarTurno,
  borrar,
  configurarDispositivo,
  crear,
  inicializarNegocio,
  guardar,
  registrarDevolucion,
  registrarMovimiento,
  registrarVenta,
} from './escrituras';

beforeEach(async () => {
  await Promise.all(bd.tables.map((t) => t.clear()));
});

const dispositivo = {
  id: 'caja-1',
  nombre: 'Caja 1',
  tipo: 'caja' as const,
  prefijo: 'A',
  ultimoFolio: 122,
  activo: true,
};

function ventaSinFolio(): VentaNueva {
  const {
    folio: _f,
    folioNumero: _n,
    actualizadoEn: _a,
    ...resto
  } = ventaPrueba({ id: crypto.randomUUID() });
  return resto;
}

describe('escrituras con outbox', () => {
  test('crear guarda el registro y su operación', async () => {
    const cafes = categoriaPrueba('cafes');
    const { actualizadoEn: _, ...sinFecha } = cafes;
    await crear('categorias', sinFecha);
    expect(await bd.categorias.get(cafes.id)).toMatchObject({ nombre: 'Cafés' });
    const ops = await bd.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tabla: 'categorias', tipo: 'crear', registroId: cafes.id, intentos: 0 });
    expect(ops[0]!.datos).toMatchObject({ nombre: 'Cafés' });
  });

  test('guardar decide entre crear y actualizar y manda el registro completo', async () => {
    const { actualizadoEn: _, ...cafes } = categoriaPrueba('cafes');
    await guardar('categorias', cafes);
    await guardar('categorias', { ...cafes, nombre: 'Café' });
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => o.tipo)).toEqual(['crear', 'actualizar']);
    expect(ops[1]!.datos).toMatchObject({ id: cafes.id, nombre: 'Café', color: cafes.color });
  });

  test('actualizar manda solo los cambios', async () => {
    await bd.dispositivos.put({ ...dispositivo, actualizadoEn: '2026-09-19T00:00:00.000Z' });
    const venta = await registrarVenta(ventaSinFolio());
    await bd.outbox.clear();
    await actualizar('ventas', venta.id, { estado: 'cancelada' });
    expect((await bd.ventas.get(venta.id))?.estado).toBe('cancelada');
    const [op] = await bd.outbox.toArray();
    expect(Object.keys(op!.datos).sort()).toEqual(['actualizadoEn', 'estado']);
  });

  test('actualizar algo que no existe falla sin dejar operación', async () => {
    await expect(actualizar('ventas', 'no-existe', { estado: 'cancelada' })).rejects.toThrow();
    expect(await bd.outbox.count()).toBe(0);
  });

  test('borrar quita el registro y encola la lápida', async () => {
    const { actualizadoEn: _, ...cafes } = categoriaPrueba('cafes');
    await crear('categorias', cafes);
    await borrar('categorias', cafes.id);
    expect(await bd.categorias.get(cafes.id)).toBeUndefined();
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => o.tipo)).toEqual(['crear', 'borrar']);
  });

  test('si falla la transacción no queda ni el registro ni la operación', async () => {
    const { actualizadoEn: _, ...cafes } = categoriaPrueba('cafes');
    await crear('categorias', cafes);
    await expect(crear('categorias', cafes)).rejects.toThrow();
    expect(await bd.outbox.count()).toBe(1);
  });

  test('avisa al motor de sync', async () => {
    let avisos = 0;
    const quitar = alEscribir(() => avisos++);
    const { actualizadoEn: _, ...cafes } = categoriaPrueba('cafes');
    await crear('categorias', cafes);
    quitar();
    await borrar('categorias', cafes.id);
    expect(avisos).toBe(1);
  });
});

describe('registrarVenta', () => {
  test('asigna el folio, sube el contador y encola ambas operaciones', async () => {
    await bd.dispositivos.put({ ...dispositivo, actualizadoEn: '2026-09-19T00:00:00.000Z' });
    const a = await registrarVenta(ventaSinFolio());
    const b = await registrarVenta(ventaSinFolio());
    expect([a.folio, b.folio]).toEqual(['A-000123', 'A-000124']);
    expect((await bd.dispositivos.get('caja-1'))?.ultimoFolio).toBe(124);
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => `${o.tabla}:${o.tipo}`)).toEqual([
      'ventas:crear',
      'dispositivos:actualizar',
      'ventas:crear',
      'dispositivos:actualizar',
    ]);
    expect(ops[0]!.datos).toMatchObject({ folio: 'A-000123', lineas: a.lineas });
  });

  test('folios concurrentes no se repiten', async () => {
    await bd.dispositivos.put({
      ...dispositivo,
      ultimoFolio: 0,
      activo: true,
      actualizadoEn: '2026-09-19T00:00:00.000Z',
    });
    const ventas = await Promise.all(Array.from({ length: 5 }, () => registrarVenta(ventaSinFolio())));
    expect(new Set(ventas.map((v) => v.folio)).size).toBe(5);
  });

  test('sin dispositivo configurado no se guarda nada', async () => {
    await expect(registrarVenta(ventaSinFolio())).rejects.toThrow('no está configurado');
    expect(await bd.ventas.count()).toBe(0);
    expect(await bd.outbox.count()).toBe(0);
  });
});

describe('configurarDispositivo', () => {
  test('crea el dispositivo, lo recuerda y encola su operación', async () => {
    const d = await configurarDispositivo({ nombre: ' Caja 1 ', tipo: 'caja', prefijo: 'A' });
    expect(d).toMatchObject({ nombre: 'Caja 1', prefijo: 'A', ultimoFolio: 0 });
    expect(await leerMeta('dispositivoId')).toBe(d.id);
    expect((await bd.outbox.toArray()).map((o) => o.tabla)).toEqual(['dispositivos']);
  });

  test('el contador arranca en el mayor entre el servidor y las ventas con ese prefijo', async () => {
    await bd.dispositivos.put({
      ...dispositivo,
      id: 'vieja',
      prefijo: 'B',
      ultimoFolio: 40,
      activo: true,
      actualizadoEn: '2026-09-19T00:00:00.000Z',
    });
    await bd.ventas.put(ventaPrueba({ id: 'v1', folio: 'B-000045', folioNumero: 45 }));
    await bd.ventas.put(ventaPrueba({ id: 'v2', folio: 'C-000099', folioNumero: 99 }));
    const d = await configurarDispositivo({ nombre: 'Caja nueva', tipo: 'caja', prefijo: 'B' });
    expect(d.ultimoFolio).toBe(45);
  });

  test('cambiar solo el nombre conserva el contador', async () => {
    await configurarDispositivo({ nombre: 'Caja 1', tipo: 'caja', prefijo: 'A' });
    const id = (await leerMeta('dispositivoId'))!;
    await bd.dispositivos.update(id, { ultimoFolio: 12 });
    const d = await configurarDispositivo({ nombre: 'Caja principal', tipo: 'caja', prefijo: 'A' });
    expect(d).toMatchObject({ id, nombre: 'Caja principal', ultimoFolio: 12 });
  });
});

describe('inicializarNegocio', () => {
  test('crea configuración, Administrador y menú de ejemplo sin usuarios demo', async () => {
    const admin = await inicializarNegocio({
      nombreNegocio: 'Café Luna',
      admin: { nombre: 'Rosa', pin: '4321' },
      cargarMenu: true,
    });
    expect(admin).toMatchObject({ nombre: 'Rosa', rol: 'admin', activo: true });
    expect(await verificarPin('4321', admin)).toBe(true);
    expect((await bd.config.get('general'))?.datos.negocio).toMatchObject({
      nombre: 'Café Luna',
      direccion: '',
    });
    expect(await bd.usuarios.count()).toBe(1);
    expect(await bd.productos.count()).toBe(30);
    expect(await bd.ingredientes.count()).toBe(17);
    expect(await bd.outbox.count()).toBe(2 + 6 + 4 + 17 + 30);
  });

  test('sin menú de ejemplo', async () => {
    await inicializarNegocio({
      nombreNegocio: 'Café Luna',
      admin: { nombre: 'Rosa', pin: '4321' },
      cargarMenu: false,
    });
    expect(await bd.productos.count()).toBe(0);
    expect(await bd.outbox.count()).toBe(2);
  });
});

describe('abrirTurno', () => {
  test('abre un solo turno por dispositivo', async () => {
    await configurarDispositivo({ nombre: 'Caja 1', tipo: 'caja', prefijo: 'A' });
    const ana = { id: 'u', nombre: 'Ana' };
    const t = await abrirTurno({ fondoInicial: 50000, usuario: ana });
    expect(t).toMatchObject({
      estado: 'abierto',
      fondoInicial: 50000,
      dispositivoNombre: 'Caja 1',
      abiertoPor: ana,
    });
    await expect(abrirTurno({ fondoInicial: 0, usuario: ana })).rejects.toThrow('La caja ya está abierta.');
    expect(await bd.turnos.count()).toBe(1);
    expect((await bd.outbox.toArray()).map((o) => o.tabla)).toEqual(['dispositivos', 'turnos']);
  });
});

describe('movimientos y cierre de caja', () => {
  const ana = { id: 'u', nombre: 'Ana' };

  test('registrar, anular y cerrar con el resumen del turno', async () => {
    await configurarDispositivo({ nombre: 'Caja 1', tipo: 'caja', prefijo: 'A' });
    const turno = await abrirTurno({ fondoInicial: 50000, usuario: ana });
    const venta = ventaPrueba({ id: 'v-cierre', turnoId: turno.id });
    await bd.ventas.put(venta);
    await registrarMovimiento({
      turno,
      tipo: 'entrada',
      categoria: 'no aplica',
      concepto: 'Cambio',
      monto: 20000,
      usuario: ana,
    });
    const gasto = await registrarMovimiento({
      turno,
      tipo: 'gasto',
      categoria: 'Hielo',
      concepto: ' Bolsa ',
      monto: 8000,
      usuario: ana,
    });
    const equivocado = await registrarMovimiento({
      turno,
      tipo: 'retiro',
      categoria: null,
      concepto: 'Error',
      monto: 99900,
      usuario: ana,
    });
    expect(gasto).toMatchObject({ concepto: 'Bolsa', categoria: 'Hielo', turnoId: turno.id, anulado: false });
    await anularMovimiento(equivocado.id, ana);
    expect(await bd.movimientos.get(equivocado.id)).toMatchObject({ anulado: true, anuladoPor: ana });

    const cerrado = await cerrarTurno({
      turnoId: turno.id,
      usuario: ana,
      efectivoContado: 80000,
      nota: 'ok',
    });
    // 500 + 193.50 + 200 − 80 = 813.50 esperado; contado 800 → faltan 13.50
    expect(cerrado.resumen).toMatchObject({
      efectivoEsperado: 81350,
      efectivoContado: 80000,
      diferencia: -1350,
      entradas: 20000,
      retiros: 0,
    });
    expect(await bd.turnos.get(turno.id)).toMatchObject({
      estado: 'cerrado',
      cerradoPor: ana,
      efectivoContado: 80000,
      nota: 'ok',
    });
    await expect(cerrarTurno({ turnoId: turno.id, usuario: ana, efectivoContado: 0 })).rejects.toThrow(
      'La caja ya está cerrada.',
    );
    const ultima = (await bd.outbox.orderBy('orden').toArray()).at(-1)!;
    expect(ultima).toMatchObject({ tabla: 'turnos', tipo: 'actualizar' });
    expect(ultima.datos).toHaveProperty('resumen.diferencia', -1350);
  });
});

describe('cancelaciones y devoluciones', () => {
  const ana = { id: 'u', nombre: 'Ana' };
  const encargada = { id: 'e', nombre: 'Encargada' };

  async function ventaEnTurnoAbierto() {
    await configurarDispositivo({ nombre: 'Caja 1', tipo: 'caja', prefijo: 'A' });
    const turno = await abrirTurno({ fondoInicial: 50000, usuario: ana });
    const venta = ventaPrueba({ id: crypto.randomUUID(), turnoId: turno.id });
    await bd.ventas.put(venta);
    await bd.outbox.clear();
    return { turno, venta };
  }

  test('cancelar marca la venta y deja de contar', async () => {
    const { venta, turno } = await ventaEnTurnoAbierto();
    await expect(
      cancelarVenta({ ventaId: venta.id, motivo: ' ', usuario: ana, autorizadoPor: null }),
    ).rejects.toThrow();
    await cancelarVenta({
      ventaId: venta.id,
      motivo: 'Se arrepintió',
      usuario: ana,
      autorizadoPor: encargada,
    });
    expect(await bd.ventas.get(venta.id)).toMatchObject({
      estado: 'cancelada',
      cancelacion: { motivo: 'Se arrepintió', usuario: ana, autorizadoPor: encargada },
    });
    const [op] = await bd.outbox.toArray();
    expect(Object.keys(op!.datos).sort()).toEqual(['actualizadoEn', 'cancelacion', 'estado']);
    await expect(
      cancelarVenta({ ventaId: venta.id, motivo: 'otra vez', usuario: ana, autorizadoPor: null }),
    ).rejects.toThrow();
    const cerrado = await cerrarTurno({ turnoId: turno.id, usuario: ana, efectivoContado: 50000 });
    expect(cerrado.resumen).toMatchObject({
      ventas: 0,
      cancelaciones: { cantidad: 1 },
      efectivoEsperado: 50000,
    });
  });

  test('no se cancela una venta de un turno cerrado', async () => {
    const { venta, turno } = await ventaEnTurnoAbierto();
    await cerrarTurno({ turnoId: turno.id, usuario: ana, efectivoContado: 0 });
    await expect(
      cancelarVenta({ ventaId: venta.id, motivo: 'x', usuario: ana, autorizadoPor: null }),
    ).rejects.toThrow('turno que sigue abierto');
  });

  test('caso I: devolver 1 Brownie en efectivo reembolsa $40.50 y ajusta el esperado', async () => {
    const { venta, turno } = await ventaEnTurnoAbierto();
    const d = await registrarDevolucion({
      ventaId: venta.id,
      seleccion: [{ lineaId: 'l-brownie', cantidad: 1 }],
      metodo: 'efectivo',
      motivo: 'Frío',
      usuario: ana,
      autorizadoPor: null,
    });
    expect(d).toMatchObject({ monto: 4050, turnoId: turno.id, folioVenta: venta.folio, metodo: 'efectivo' });
    expect(await bd.ventas.get(venta.id)).toMatchObject({ estado: 'devuelta_parcial', devuelto: 4050 });
    expect((await bd.outbox.toArray()).map((o) => `${o.tabla}:${o.tipo}`)).toEqual([
      'devoluciones:crear',
      'ventas:actualizar',
    ]);
    const cerrado = await cerrarTurno({ turnoId: turno.id, usuario: ana, efectivoContado: 0 });
    expect(cerrado.resumen?.efectivoEsperado).toBe(50000 + 19350 - 4050);

    // lo que queda de la venta se devuelve con tarjeta (sin caja abierta)
    const resto = await registrarDevolucion({
      ventaId: venta.id,
      seleccion: [{ lineaId: 'l-latte', cantidad: 2 }],
      metodo: 'tarjeta',
      motivo: 'Todo',
      usuario: ana,
      autorizadoPor: null,
    });
    expect(resto).toMatchObject({ monto: 19350 - 4050, turnoId: null });
    expect(await bd.ventas.get(venta.id)).toMatchObject({ estado: 'devuelta', devuelto: 19350 });
  });

  test('en efectivo requiere caja abierta en este dispositivo', async () => {
    const { venta, turno } = await ventaEnTurnoAbierto();
    await cerrarTurno({ turnoId: turno.id, usuario: ana, efectivoContado: 0 });
    await expect(
      registrarDevolucion({
        ventaId: venta.id,
        seleccion: [{ lineaId: 'l-brownie', cantidad: 1 }],
        metodo: 'efectivo',
        motivo: 'x',
        usuario: ana,
        autorizadoPor: null,
      }),
    ).rejects.toThrow('abre la caja');
    expect(await bd.devoluciones.count()).toBe(0);
  });
});
