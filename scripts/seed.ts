// Datos demo en la base local PGlite (idempotente). Nunca usa DATABASE_URL.
import { fileURLToPath } from 'node:url';
import { ahoraISO } from '../src/dominio/fechas';
import { configInicial, menuDeEjemplo, usuariosDemo } from '../src/dominio/menuEjemplo';
import { crearPin } from '../src/dominio/pin';
import { hashContrasena } from '../servidor/auth';
import { conectarBaseDatos, type BaseDatos } from '../servidor/db/cliente';
import {
  categorias,
  config,
  cuentas,
  gruposModificadores,
  ingredientes,
  productos,
  usuarios,
} from '../servidor/db/esquema';
import { migrarBaseDatos } from '../servidor/db/migrar';
import { aFila } from '../servidor/db/registros';

export const CUENTA_DEMO = { correo: 'caja@demo.test', contrasena: 'demo1234' };

/** Inserta lo que falte; lo que ya existe no se toca. */
export async function sembrar(db: BaseDatos): Promise<void> {
  const ahora = ahoraISO();
  const menu = menuDeEjemplo(ahora);
  await db
    .insert(cuentas)
    .values({
      id: 'cuenta-demo',
      correo: CUENTA_DEMO.correo,
      hashContrasena: await hashContrasena(CUENTA_DEMO.contrasena),
    })
    .onConflictDoNothing();
  await db
    .insert(config)
    .values({ id: 'general', datos: configInicial(), actualizadoEn: new Date(ahora) })
    .onConflictDoNothing();
  const conPin = await Promise.all(
    usuariosDemo.map(async ({ pin, ...u }) => ({
      ...u,
      ...(await crearPin(pin)),
      activo: true,
      actualizadoEn: ahora,
    })),
  );
  await db
    .insert(usuarios)
    .values(conPin.map((u) => aFila(u)) as never)
    .onConflictDoNothing();
  await db
    .insert(categorias)
    .values(menu.categorias.map((c) => aFila(c)) as never)
    .onConflictDoNothing();
  await db
    .insert(gruposModificadores)
    .values(menu.gruposModificadores.map((g) => aFila(g)) as never)
    .onConflictDoNothing();
  await db
    .insert(ingredientes)
    .values(menu.ingredientes.map((i) => aFila(i)) as never)
    .onConflictDoNothing();
  await db
    .insert(productos)
    .values(menu.productos.map((p) => aFila(p)) as never)
    .onConflictDoNothing();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dirPglite = process.env.PGLITE_DIR ?? './.pglite';
  const conexion = await conectarBaseDatos({ dirPglite });
  await migrarBaseDatos(conexion);
  await sembrar(conexion.db);
  await conexion.cerrar();
  console.log(`Datos demo listos en ${dirPglite}. Cuenta ${CUENTA_DEMO.correo} / ${CUENTA_DEMO.contrasena}.`);
}
