import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { esquemaPeticionAcceso } from '../../src/dominio/esquemas.js';
import { firmarToken, LimiteIntentos, verificarContrasena } from '../auth.js';
import type { BaseDatos } from '../db/cliente.js';
import { cuentas } from '../db/esquema.js';

export function rutasAcceso(db: BaseDatos, secreto: string, limite = new LimiteIntentos()) {
  return new Hono().post('/', async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
    if (limite.bloqueado(ip)) {
      return c.json({ error: 'Demasiados intentos. Espera un minuto y vuelve a intentar.' }, 429);
    }
    const peticion = esquemaPeticionAcceso.safeParse(await c.req.json().catch(() => null));
    if (!peticion.success) return c.json({ error: 'Escribe un correo y una contraseña válidos.' }, 400);

    const correo = peticion.data.correo.trim().toLowerCase();
    const [cuenta] = await db.select().from(cuentas).where(eq(cuentas.correo, correo));
    if (!cuenta || !(await verificarContrasena(peticion.data.contrasena, cuenta.hashContrasena))) {
      limite.fallo(ip);
      return c.json({ error: 'Correo o contraseña incorrectos.' }, 401);
    }
    if (!cuenta.activa) return c.json({ error: 'Esta cuenta está desactivada.' }, 401);
    limite.exito(ip);
    const token = await firmarToken(cuenta.id, secreto);
    return c.json({ token, cuenta: { id: cuenta.id, correo: cuenta.correo } });
  });
}
