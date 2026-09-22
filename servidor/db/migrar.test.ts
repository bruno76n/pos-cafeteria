import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { crearBasePrueba } from './basePrueba';
import type { ConexionBaseDatos } from './cliente';
import { categorias, gruposModificadores, productos, ventas } from './esquema';
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
    'ingredientes',
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

test('el grupo global "Tamaño" pasa a tamaños de cada producto y se elimina', async () => {
  const antes = new Date('2026-09-01T12:00:00.000Z');
  const opcion = (id: string, nombre: string, precioExtra: number, porDefecto = false) => ({
    id,
    nombre,
    precioExtra,
    porDefecto,
    disponible: true,
  });
  await conexion.db.insert(gruposModificadores).values([
    {
      id: 'g-tamano',
      nombre: 'Tamaño',
      tipo: 'unico',
      obligatorio: true,
      min: 1,
      max: 1,
      orden: 1,
      opciones: [opcion('grande', 'Grande', 2000), opcion('chico', 'Chico', 0, true)],
      actualizadoEn: antes,
    },
    {
      id: 'g-leche',
      nombre: 'Leche',
      tipo: 'unico',
      obligatorio: true,
      min: 1,
      max: 1,
      orden: 2,
      opciones: [opcion('entera', 'Entera', 0, true)],
      actualizadoEn: antes,
    },
  ]);
  const producto = (id: string, gruposIds: string[]) => ({
    id,
    nombre: id,
    descripcion: '',
    categoriaId: 'c1',
    precio: 6500,
    disponible: true,
    orden: 1,
    gruposIds,
    actualizadoEn: antes,
  });
  await conexion.db
    .insert(productos)
    .values([producto('latte', ['g-leche', 'g-tamano']), producto('brownie', [])]);
  const [{ rev: revAntes } = { rev: 0 }] = await conexion.db
    .select({ rev: productos.rev })
    .from(productos)
    .where(eq(productos.id, 'latte'));

  // Pasos de datos de la migración 0001 (el primero es el ALTER TABLE, ya aplicado).
  const pasos = readFileSync(new URL('../../drizzle/0001_tamanos.sql', import.meta.url), 'utf8')
    .split('--> statement-breakpoint')
    .slice(1);
  for (const paso of pasos) await conexion.db.execute(sql.raw(paso));

  const [latte] = await conexion.db.select().from(productos).where(eq(productos.id, 'latte'));
  expect(latte!.tamanos).toEqual([
    { id: 'chico', nombre: 'Chico', precio: 6500 },
    { id: 'grande', nombre: 'Grande', precio: 8500 },
  ]);
  expect(latte!.gruposIds).toEqual(['g-leche']);
  expect(latte!.rev).toBeGreaterThan(revAntes);
  expect(latte!.actualizadoEn.getTime()).toBeGreaterThan(antes.getTime());
  const [brownie] = await conexion.db.select().from(productos).where(eq(productos.id, 'brownie'));
  expect(brownie!.tamanos).toEqual([]);
  const grupos = await conexion.db.select().from(gruposModificadores);
  expect(Object.fromEntries(grupos.map((g) => [g.id, g.borrado]))).toEqual({
    'g-tamano': true,
    'g-leche': false,
  });
});
