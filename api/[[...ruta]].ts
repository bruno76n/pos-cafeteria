// Vercel Function (runtime Node): expone la app de Hono de servidor/app.ts.
import { handle } from 'hono/vercel';
import { crearApp } from '../servidor/app.js';
import { conectarBaseDatos } from '../servidor/db/cliente.js';

let app: ReturnType<typeof crearApp> | undefined;

async function obtenerApp() {
  if (!app) {
    const { DATABASE_URL, JWT_SECRET } = process.env;
    if (!DATABASE_URL || !JWT_SECRET) throw new Error('Faltan DATABASE_URL o JWT_SECRET');
    const conexion = await conectarBaseDatos({ databaseUrl: DATABASE_URL });
    app = crearApp({ db: conexion.db, jwtSecret: JWT_SECRET });
  }
  return app;
}

const manejar = async (req: Request) => handle(await obtenerApp())(req);

export const GET = manejar;
export const POST = manejar;
