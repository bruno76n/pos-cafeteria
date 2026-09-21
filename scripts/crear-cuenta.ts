// Crea (o reactiva con nueva contraseña) una cuenta de acceso.
// Producción: DATABASE_URL=... npm run crear-cuenta -- correo contraseña
// Sin DATABASE_URL usa la base local PGlite.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashContrasena } from '../servidor/auth';
import { conectarBaseDatos } from '../servidor/db/cliente';
import { cuentas } from '../servidor/db/esquema';

const [correoCrudo, contrasena] = process.argv.slice(2);
const correo = z.email().safeParse(correoCrudo?.trim().toLowerCase());
if (!correo.success || !contrasena || contrasena.length < 8) {
  console.error('Uso: npm run crear-cuenta -- correo@dominio.mx contraseña (mínimo 8 caracteres)');
  process.exit(1);
}

const conexion = await conectarBaseDatos({
  databaseUrl: process.env.DATABASE_URL,
  dirPglite: process.env.PGLITE_DIR ?? './.pglite',
});
const hash = await hashContrasena(contrasena);
const [existente] = await conexion.db
  .select({ id: cuentas.id })
  .from(cuentas)
  .where(eq(cuentas.correo, correo.data));
if (existente) {
  await conexion.db
    .update(cuentas)
    .set({ hashContrasena: hash, activa: true })
    .where(eq(cuentas.id, existente.id));
  console.log(`Cuenta ${correo.data} actualizada (${conexion.tipo}).`);
} else {
  await conexion.db
    .insert(cuentas)
    .values({ id: crypto.randomUUID(), correo: correo.data, hashContrasena: hash });
  console.log(`Cuenta ${correo.data} creada (${conexion.tipo}).`);
}
await conexion.cerrar();
