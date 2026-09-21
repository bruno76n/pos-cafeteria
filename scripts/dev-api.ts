// API local: @hono/node-server + PGlite en ./.pglite (o en PGLITE_DIR), con migraciones aplicadas.
import { serve } from '@hono/node-server';
import { crearApp } from '../servidor/app';
import { conectarBaseDatos } from '../servidor/db/cliente';
import { migrarBaseDatos } from '../servidor/db/migrar';

try {
  process.loadEnvFile('.env.development');
} catch {
  // sin archivo: se usan las variables del entorno
}

const puerto = Number(process.env.API_PUERTO ?? 8787);
const dirPglite = process.env.PGLITE_DIR ?? './.pglite';
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('Falta JWT_SECRET (ver .env.development)');

const conexion = await conectarBaseDatos({ dirPglite });
await migrarBaseDatos(conexion);
const app = crearApp({ db: conexion.db, jwtSecret });

serve({ fetch: app.fetch, port: puerto }, () => {
  console.log(`API local en http://localhost:${puerto}/api (PGlite en ${dirPglite})`);
});

const cerrar = async () => {
  await conexion.cerrar();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
