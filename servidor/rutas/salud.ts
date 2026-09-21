import { Hono } from 'hono';

export const rutasSalud = new Hono().get('/', (c) => c.json({ ok: true }));
