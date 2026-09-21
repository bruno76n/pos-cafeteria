import { beforeEach, describe, expect, test } from 'vitest';
import { categoriasPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { bd } from './bd';
import {
  actualizar,
  alEscribir,
  borrar,
  crear,
  guardar,
  registrarVenta,
  type VentaSinFolio,
} from './escrituras';

beforeEach(async () => {
  await Promise.all(bd.tables.map((t) => t.clear()));
});

const dispositivo = { id: 'caja-1', nombre: 'Caja 1', tipo: 'caja' as const, prefijo: 'A', ultimoFolio: 122 };

function ventaSinFolio(): VentaSinFolio {
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
    const cafes = categoriasPrueba[0]!;
    const { actualizadoEn: _, ...sinFecha } = cafes;
    await crear('categorias', sinFecha);
    expect(await bd.categorias.get(cafes.id)).toMatchObject({ nombre: 'Cafés' });
    const ops = await bd.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tabla: 'categorias', tipo: 'crear', registroId: cafes.id, intentos: 0 });
    expect(ops[0]!.datos).toMatchObject({ nombre: 'Cafés' });
  });

  test('guardar decide entre crear y actualizar y manda el registro completo', async () => {
    const { actualizadoEn: _, ...cafes } = categoriasPrueba[0]!;
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
    const { actualizadoEn: _, ...cafes } = categoriasPrueba[0]!;
    await crear('categorias', cafes);
    await borrar('categorias', cafes.id);
    expect(await bd.categorias.get(cafes.id)).toBeUndefined();
    const ops = await bd.outbox.orderBy('orden').toArray();
    expect(ops.map((o) => o.tipo)).toEqual(['crear', 'borrar']);
  });

  test('si falla la transacción no queda ni el registro ni la operación', async () => {
    const { actualizadoEn: _, ...cafes } = categoriasPrueba[0]!;
    await crear('categorias', cafes);
    await expect(crear('categorias', cafes)).rejects.toThrow();
    expect(await bd.outbox.count()).toBe(1);
  });

  test('avisa al motor de sync', async () => {
    let avisos = 0;
    const quitar = alEscribir(() => avisos++);
    const { actualizadoEn: _, ...cafes } = categoriasPrueba[0]!;
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
    await bd.dispositivos.put({ ...dispositivo, ultimoFolio: 0, actualizadoEn: '2026-09-19T00:00:00.000Z' });
    const ventas = await Promise.all(Array.from({ length: 5 }, () => registrarVenta(ventaSinFolio())));
    expect(new Set(ventas.map((v) => v.folio)).size).toBe(5);
  });

  test('sin dispositivo configurado no se guarda nada', async () => {
    await expect(registrarVenta(ventaSinFolio())).rejects.toThrow('no está configurado');
    expect(await bd.ventas.count()).toBe(0);
    expect(await bd.outbox.count()).toBe(0);
  });
});
