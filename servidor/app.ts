import { Hono } from 'hono';
import type { BaseDatos } from './db/cliente';
import { rutasSalud } from './rutas/salud';

export interface DependenciasApp {
  db: BaseDatos;
  jwtSecret: string;
}

export function crearApp(_deps: DependenciasApp) {
  const app = new Hono().basePath('/api');
  app.route('/salud', rutasSalud);
  return app;
}
