import { beforeEach, describe, expect, test } from 'vitest';
import { categoriaPrueba, configPrueba, cuentaPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { diaLocal } from '@/dominio/fechas';
import type { LineaVenta } from '@/dominio/tipos';
import type { VentaNueva } from '@/dominio/cobro';
import { verificarPin } from '@/dominio/pin';
import { bd, leerMeta } from './bd';
import {
  actualizar,
  alEscribir,
  abrirCuenta,
  abrirTurno,
  anularLinea,
  anularMovimiento,
  cancelarCuenta,
  cancelarVenta,
  cobrarCuenta,
  cobrarVentaRapida,
  cerrarTurno,
  borrar,
  configurarDispositivo,
  crear,
  enviarPedido,
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

describe('cuentas abiertas', () => {
  const ana = { id: 'cajero', nombre: 'Ana' };
  const [latte, brownie] = ventaPrueba().lineas as [LineaVenta, LineaVenta];
  const cafe: LineaVenta = {
    ...brownie,
    id: 'l-cafe',
    nombre: 'Café',
    precioUnitario: 4000,
    importe: 4000,
    nota: null,
  };
  const apertura = {
    nombre: null,
    turno: { id: 'turno-1' },
    dispositivo: { id: 'caja-1', nombre: 'Caja 1' },
    usuario: ana,
  };
  const cobro = {
    descuento: null,
    cliente: null,
    config: configPrueba.ventas,
    turno: { id: 'turno-2' },
    dispositivo: { id: 'caja-1', nombre: 'Caja 1' },
    cajero: ana,
  };
  const efectivo = (monto: number) => [{ metodo: 'efectivo' as const, monto, recibido: monto }];

  beforeEach(async () => {
    await bd.dispositivos.put({ ...dispositivo, actualizadoEn: '2026-09-19T00:00:00.000Z' });
  });

  test('el número de cuenta reinicia cada día y en cada dispositivo', async () => {
    await bd.cuentasVenta.bulkPut([
      cuentaPrueba({ id: 'ayer-1', numero: 40, dia: '2026-01-01' }),
      cuentaPrueba({ id: 'otra-caja', numero: 7, dispositivoId: 'caja-2', dia: diaLocal() }),
    ]);
    const a = await abrirCuenta({ ...apertura, nombre: ' Luis ' });
    const b = await abrirCuenta(apertura);
    expect([a.numero, b.numero]).toEqual([1, 2]);
    expect(a).toMatchObject({ nombre: 'Luis', estado: 'abierta', turnoId: 'turno-1', dia: diaLocal() });
    expect(b.nombre).toBeNull();
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => [o.tabla, o.tipo])).toEqual([
      ['cuentasVenta', 'crear'],
      ['cuentasVenta', 'crear'],
    ]);
  });

  test('enviar pedidos: el primero abre la cuenta y cada uno lleva su número de comanda', async () => {
    const { cuenta, pedido } = await enviarPedido({
      destino: { abrir: apertura },
      lineas: [latte],
      usuario: ana,
      nombre: 'Luis',
    });
    expect(cuenta).toMatchObject({ numero: 1, nombre: 'Luis' });
    expect(pedido).toMatchObject({ cuentaId: cuenta.id, numero: 1, tipo: 'normal', autorizadoPor: null });
    const segundo = await enviarPedido({
      destino: { cuentaId: cuenta.id },
      lineas: [cafe],
      usuario: ana,
      nombre: 'Otro nombre',
    });
    expect(segundo.pedido.numero).toBe(2);
    // El nombre que ya tenía no se pisa.
    expect((await bd.cuentasVenta.get(cuenta.id))?.nombre).toBe('Luis');
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => [o.tabla, o.tipo])).toEqual([
      ['cuentasVenta', 'crear'],
      ['pedidos', 'crear'],
      ['pedidos', 'crear'],
    ]);
  });

  test('el nombre del borrador se le pone a la cuenta si no tenía', async () => {
    const cuenta = await abrirCuenta(apertura);
    await enviarPedido({ destino: { cuentaId: cuenta.id }, lineas: [latte], usuario: ana, nombre: 'Marta' });
    expect((await bd.cuentasVenta.get(cuenta.id))?.nombre).toBe('Marta');
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => [o.tabla, o.tipo])).toEqual([
      ['cuentasVenta', 'crear'],
      ['cuentasVenta', 'actualizar'],
      ['pedidos', 'crear'],
    ]);
    expect(ops[1]!.datos).toMatchObject({ nombre: 'Marta' });
  });

  test('no se envía nada vacío ni a una cuenta que ya no está abierta', async () => {
    const cuenta = await abrirCuenta(apertura);
    await expect(
      enviarPedido({ destino: { cuentaId: cuenta.id }, lineas: [], usuario: ana }),
    ).rejects.toThrow('No hay nada que enviar.');
    await cancelarCuenta({ cuentaId: cuenta.id, motivo: '', usuario: ana, autorizadoPor: null });
    await expect(
      enviarPedido({ destino: { cuentaId: cuenta.id }, lineas: [latte], usuario: ana }),
    ).rejects.toThrow('Esta cuenta ya no está abierta.');
    expect(await bd.pedidos.count()).toBe(0);
  });

  test('anular una línea guarda un pedido de anulación con quien autorizó', async () => {
    const { cuenta } = await enviarPedido({
      destino: { abrir: apertura },
      lineas: [latte, cafe],
      usuario: ana,
    });
    const encargada = { id: 'enc', nombre: 'Encargada' };
    const { pedido } = await anularLinea({
      cuentaId: cuenta.id,
      lineaId: latte.id,
      cantidad: 1,
      usuario: ana,
      autorizadoPor: encargada,
    });
    expect(pedido).toMatchObject({ numero: 2, tipo: 'anulacion', autorizadoPor: encargada });
    // La anulación recuerda de qué comanda quita la pieza.
    expect(pedido.lineas).toEqual([{ ...latte, cantidad: 1, importe: 8500, comanda: 1 }]);
    // El pedido original no cambia.
    expect((await bd.pedidos.toArray()).find((p) => p.tipo === 'normal')?.lineas[0]?.cantidad).toBe(2);
    await expect(
      anularLinea({ cuentaId: cuenta.id, lineaId: latte.id, cantidad: 2, usuario: ana, autorizadoPor: null }),
    ).rejects.toThrow('Solo quedan 1 en la cuenta.');
    expect(await bd.pedidos.count()).toBe(2);
  });

  test('cobrar la cuenta: folio, venta con las líneas vigentes y cuenta cobrada, en una transacción', async () => {
    const { cuenta } = await enviarPedido({
      destino: { abrir: apertura },
      lineas: [latte, cafe],
      usuario: ana,
      nombre: 'Luis',
    });
    await enviarPedido({ destino: { cuentaId: cuenta.id }, lineas: [brownie], usuario: ana });
    await anularLinea({
      cuentaId: cuenta.id,
      lineaId: cafe.id,
      cantidad: 1,
      usuario: ana,
      autorizadoPor: null,
    });
    await bd.outbox.clear();

    const total = 17000 + 4500;
    const r = await cobrarCuenta({ ...cobro, cuentaId: cuenta.id, pagos: efectivo(total) });
    expect(r.venta).toMatchObject({
      folio: 'A-000123',
      folioNumero: 123,
      turnoId: 'turno-2',
      cliente: 'Luis',
      cuentaId: cuenta.id,
      cuentaNumero: 1,
      cuentaComandas: 3,
      total,
      estado: 'pagada',
    });
    expect(r.venta.lineas.map((l) => [l.nombre, l.cantidad, l.comanda])).toEqual([
      ['Latte', 2, 1],
      ['Brownie', 1, 2],
    ]);
    expect(await bd.cuentasVenta.get(cuenta.id)).toMatchObject({
      estado: 'cobrada',
      ventaId: r.venta.id,
      turnoId: 'turno-1',
    });
    expect((await bd.dispositivos.get('caja-1'))?.ultimoFolio).toBe(123);
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => [o.tabla, o.tipo])).toEqual([
      ['ventas', 'crear'],
      ['dispositivos', 'actualizar'],
      ['cuentasVenta', 'actualizar'],
    ]);
    expect(ops[2]!.datos).toMatchObject({ estado: 'cobrada', ventaId: r.venta.id });
  });

  test('si el cobro falla no queda nada a medias', async () => {
    const { cuenta } = await enviarPedido({ destino: { abrir: apertura }, lineas: [latte], usuario: ana });
    await bd.outbox.clear();
    await expect(
      cobrarCuenta({ ...cobro, cuentaId: cuenta.id, pagos: [{ metodo: 'tarjeta', monto: 100 }] }),
    ).rejects.toThrow('Los pagos no cubren el total.');
    expect(await bd.ventas.count()).toBe(0);
    expect((await bd.cuentasVenta.get(cuenta.id))?.estado).toBe('abierta');
    expect((await bd.dispositivos.get('caja-1'))?.ultimoFolio).toBe(122);
    expect(await bd.outbox.count()).toBe(0);
  });

  test('una cuenta cobrada no se cobra otra vez y una vacía no se cobra', async () => {
    const vacia = await abrirCuenta(apertura);
    await expect(cobrarCuenta({ ...cobro, cuentaId: vacia.id, pagos: [] })).rejects.toThrow(
      'La cuenta no tiene productos que cobrar.',
    );
    const { cuenta } = await enviarPedido({ destino: { abrir: apertura }, lineas: [cafe], usuario: ana });
    await cobrarCuenta({ ...cobro, cuentaId: cuenta.id, pagos: efectivo(4000) });
    await expect(cobrarCuenta({ ...cobro, cuentaId: cuenta.id, pagos: efectivo(4000) })).rejects.toThrow(
      'Esta cuenta ya no está abierta.',
    );
    expect(await bd.ventas.count()).toBe(1);
  });

  test('el descuento y el "Para:" del borrador se aplican al cobrar', async () => {
    const { cuenta } = await enviarPedido({ destino: { abrir: apertura }, lineas: [latte], usuario: ana });
    const r = await cobrarCuenta({
      ...cobro,
      cuentaId: cuenta.id,
      cliente: 'Para llevar',
      descuento: { tipo: 'porcentaje', valor: 10, motivo: null, autorizadoPor: null },
      pagos: efectivo(15300),
    });
    expect(r.venta).toMatchObject({ cliente: 'Para llevar', subtotal: 17000, total: 15300 });
    expect(r.venta.descuento).toMatchObject({ importe: 1700 });
  });

  test('venta rápida: abre la cuenta, guarda su pedido, cobra y la deja cobrada', async () => {
    const r = await cobrarVentaRapida({ ...cobro, cliente: 'Luis', lineas: [latte], pagos: efectivo(17000) });
    expect(r.cuenta).toMatchObject({
      numero: 1,
      nombre: 'Luis',
      estado: 'cobrada',
      ventaId: r.venta.id,
      turnoId: 'turno-2',
    });
    expect(r.pedidos).toHaveLength(1);
    expect(r.pedidos[0]).toMatchObject({ numero: 1, tipo: 'normal' });
    expect(r.venta).toMatchObject({
      folio: 'A-000123',
      cuentaId: r.cuenta.id,
      cuentaComandas: 1,
      cliente: 'Luis',
    });
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => [o.tabla, o.tipo])).toEqual([
      ['cuentasVenta', 'crear'],
      ['pedidos', 'crear'],
      ['ventas', 'crear'],
      ['dispositivos', 'actualizar'],
      ['cuentasVenta', 'actualizar'],
    ]);
    // La siguiente venta rápida toma la cuenta 2.
    expect((await cobrarVentaRapida({ ...cobro, lineas: [cafe], pagos: efectivo(4000) })).cuenta.numero).toBe(
      2,
    );
  });

  test('una venta rápida con pagos incompletos no deja cuenta ni pedido', async () => {
    await expect(cobrarVentaRapida({ ...cobro, lineas: [latte], pagos: [] })).rejects.toThrow();
    expect(await bd.cuentasVenta.count()).toBe(0);
    expect(await bd.pedidos.count()).toBe(0);
  });

  test('cancelar: con pedidos pide motivo; vacía se descarta sin pedirlo', async () => {
    const { cuenta } = await enviarPedido({ destino: { abrir: apertura }, lineas: [latte], usuario: ana });
    await expect(
      cancelarCuenta({ cuentaId: cuenta.id, motivo: ' ', usuario: ana, autorizadoPor: null }),
    ).rejects.toThrow('Escribe el motivo.');
    const encargada = { id: 'enc', nombre: 'Encargada' };
    const cancelada = await cancelarCuenta({
      cuentaId: cuenta.id,
      motivo: 'Se fue',
      usuario: ana,
      autorizadoPor: encargada,
    });
    expect(cancelada).toMatchObject({
      estado: 'cancelada',
      cancelacion: { motivo: 'Se fue', usuario: ana, autorizadoPor: encargada },
    });
    expect(await bd.ventas.count()).toBe(0);

    const vacia = await abrirCuenta(apertura);
    const descartada = await cancelarCuenta({
      cuentaId: vacia.id,
      motivo: '',
      usuario: ana,
      autorizadoPor: null,
    });
    expect(descartada.cancelacion?.motivo).toBe('Sin pedidos');
  });
});
