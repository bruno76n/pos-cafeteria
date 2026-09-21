import { Hono } from 'hono';
import { requiereCuenta } from './auth';
import type { BaseDatos } from './db/cliente';
import { rutasAcceso } from './rutas/acceso';
import { rutasReportes } from './rutas/reportes';
import { rutasSalud } from './rutas/salud';
import { rutasSync } from './rutas/sync';

export interface DependenciasApp {
  db: BaseDatos;
  jwtSecret: string;
}

export function crearApp({ db, jwtSecret }: DependenciasApp) {
  const app = new Hono().basePath('/api');
  app.route('/salud', rutasSalud);
  app.route('/acceso', rutasAcceso(db, jwtSecret));
  app.use('/sync/*', requiereCuenta(db, jwtSecret));
  app.use('/reportes', requiereCuenta(db, jwtSecret));
  app.route('/sync', rutasSync(db));
  app.route('/reportes', rutasReportes(db));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: 'Error del servidor.' }, 500);
  });
  return app;
}
