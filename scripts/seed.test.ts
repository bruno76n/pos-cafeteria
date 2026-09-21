import { afterAll, beforeAll, expect, test } from 'vitest';
import { crearBasePrueba } from '../servidor/db/basePrueba';
import type { ConexionBaseDatos } from '../servidor/db/cliente';
import {
  categorias,
  config,
  cuentas,
  gruposModificadores,
  productos,
  usuarios,
} from '../servidor/db/esquema';
import { sembrar } from './seed';

let conexion: ConexionBaseDatos;
beforeAll(async () => {
  conexion = await crearBasePrueba();
});
afterAll(() => conexion.cerrar());

test('sembrar dos veces no duplica nada', async () => {
  await sembrar(conexion.db);
  const contar = async () => ({
    cuentas: (await conexion.db.select().from(cuentas)).length,
    config: (await conexion.db.select().from(config)).length,
    usuarios: (await conexion.db.select().from(usuarios)).length,
    categorias: (await conexion.db.select().from(categorias)).length,
    grupos: (await conexion.db.select().from(gruposModificadores)).length,
    productos: (await conexion.db.select().from(productos)).length,
  });
  const primera = await contar();
  expect(primera).toEqual({ cuentas: 1, config: 1, usuarios: 3, categorias: 5, grupos: 5, productos: 28 });
  await sembrar(conexion.db);
  expect(await contar()).toEqual(primera);
  const [general] = await conexion.db.select().from(config);
  expect(general?.datos.roles.cajero.verReportes).toBe(false);
  expect(general?.datos.negocio.nombre).toBe('Cafetería Demo');
});
