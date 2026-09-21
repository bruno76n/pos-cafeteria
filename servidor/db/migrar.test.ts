import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { crearBasePrueba } from './basePrueba';
import type { ConexionBaseDatos } from './cliente';
import { categorias, ventas } from './esquema';
import { migrarBaseDatos } from './migrar';

let conexion: ConexionBaseDatos;
beforeAll(async () => {
  conexion = await crearBasePrueba();
});
afterAll(() => conexion.cerrar());

test('la migración crea todas las tablas desde cero', async () => {
  const r = (await conexion.db.execute(
    sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  )) as unknown as { rows: { table_name: string }[] };
  expect(r.rows.map((f) => f.table_name)).toEqual([
    'categorias',
    'config',
    'cuentas',
    'devoluciones',
    'dispositivos',
    'grupos_modificadores',
    'movimientos',
    'operaciones_aplicadas',
    'productos',
    'turnos',
    'usuarios',
    'ventas',
  ]);
});

test('aplicar las migraciones otra vez no hace nada', async () => {
  await expect(migrarBaseDatos(conexion)).resolves.toBeUndefined();
});

test('rev sale de una secuencia compartida', async () => {
  const ahora = new Date();
  const [a] = await conexion.db
    .insert(categorias)
    .values({ id: 'c1', nombre: 'Cafés', color: '#6B4226', orden: 1, activa: true, actualizadoEn: ahora })
    .returning({ rev: categorias.rev });
  const [b] = await conexion.db
    .insert(categorias)
    .values({ id: 'c2', nombre: 'Postres', color: '#A83E5B', orden: 2, activa: true, actualizadoEn: ahora })
    .returning({ rev: categorias.rev });
  expect(b!.rev).toBeGreaterThan(a!.rev);
});

test('el folio es único', async () => {
  const venta = {
    folio: 'A-000001',
    folioNumero: 1,
    dispositivoId: 'd',
    dispositivoNombre: 'Caja 1',
    turnoId: 't',
    fecha: new Date(),
    dia: '2026-09-19',
    cajero: { id: 'u', nombre: 'Ana' },
    lineas: [],
    subtotal: 0,
    iva: { tasa: 0.16, incluido: true, base: 0, monto: 0 },
    total: 0,
    pagos: [],
    cambio: 0,
    estado: 'pagada' as const,
    devuelto: 0,
    actualizadoEn: new Date(),
  };
  await conexion.db.insert(ventas).values({ id: 'v1', ...venta });
  await expect(conexion.db.insert(ventas).values({ id: 'v2', ...venta })).rejects.toThrow();
});
