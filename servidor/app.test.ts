import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { conectarBaseDatos, type ConexionBaseDatos } from './db/cliente';
import { crearApp } from './app';

describe('GET /api/salud', () => {
  let conexion: ConexionBaseDatos;
  beforeAll(async () => {
    conexion = await conectarBaseDatos({});
  });
  afterAll(() => conexion.cerrar());

  test('responde ok sin token', async () => {
    const app = crearApp({ db: conexion.db, jwtSecret: 'prueba' });
    const res = await app.request('/api/salud');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
