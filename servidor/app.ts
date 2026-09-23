import { Hono } from 'hono';
import { requiereCuenta } from './auth.js';
import type { BaseDatos } from './db/cliente.js';
import { rutasAcceso } from './rutas/acceso.js';
import { rutasReportes } from './rutas/reportes.js';
import { rutasSalud } from './rutas/salud.js';
import { rutasSync } from './rutas/sync.js';
import { rutasTickets } from './rutas/tickets.js';

export interface DependenciasApp {
  db: BaseDatos;
  jwtSecret: string;
}

export function crearApp({ db, jwtSecret }: DependenciasApp) {
  const app = new Hono().basePath('/api');
  app.route('/salud', rutasSalud);
  app.route('/acceso', rutasAcceso(db, jwtSecret));
  app.route('/tickets', rutasTickets(db));
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
