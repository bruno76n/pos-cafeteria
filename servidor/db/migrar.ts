// Aplica las migraciones de ./drizzle. Sin DATABASE_URL usa PGlite en ./.pglite (o PGLITE_DIR).
import { fileURLToPath } from 'node:url';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { conectarBaseDatos, type ConexionBaseDatos } from './cliente';

const carpetaMigraciones = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function migrarBaseDatos(conexion: ConexionBaseDatos): Promise<void> {
  if (conexion.tipo === 'neon') {
    const { migrate } = await import('drizzle-orm/neon-http/migrator');
    await migrate(conexion.db as unknown as NeonHttpDatabase, { migrationsFolder: carpetaMigraciones });
  } else {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(conexion.db as unknown as PgliteDatabase, { migrationsFolder: carpetaMigraciones });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const conexion = await conectarBaseDatos({
    databaseUrl: process.env.DATABASE_URL,
    dirPglite: process.env.PGLITE_DIR ?? './.pglite',
  });
  await migrarBaseDatos(conexion);
  await conexion.cerrar();
  console.log(`Migraciones aplicadas (${conexion.tipo}).`);
}
