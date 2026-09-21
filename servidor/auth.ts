import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { jwtVerify, SignJWT } from 'jose';
import type { BaseDatos } from './db/cliente';
import { cuentas } from './db/esquema';

// Cuenta por dispositivo: JWT HS256 de 1 año con el id de la cuenta (docs/02-arquitectura.md §7).

const clave = (secreto: string) => new TextEncoder().encode(secreto);

export async function firmarToken(cuentaId: string, secreto: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(cuentaId)
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(clave(secreto));
}

export async function leerToken(token: string, secreto: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, clave(secreto), { algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const hashContrasena = (contrasena: string) => bcrypt.hash(contrasena, 10);
export const verificarContrasena = (contrasena: string, hash: string) => bcrypt.compare(contrasena, hash);

export type VariablesAuth = { Variables: { cuentaId: string } };

/** Exige `Authorization: Bearer <token>` de una cuenta activa. */
export function requiereCuenta(db: BaseDatos, secreto: string) {
  return createMiddleware<VariablesAuth>(async (c, next) => {
    const encabezado = c.req.header('Authorization') ?? '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : '';
    const cuentaId = token ? await leerToken(token, secreto) : null;
    if (!cuentaId) return c.json({ error: 'Sesión inválida o expirada.' }, 401);
    const [cuenta] = await db
      .select({ activa: cuentas.activa })
      .from(cuentas)
      .where(eq(cuentas.id, cuentaId));
    if (!cuenta?.activa) return c.json({ error: 'La cuenta ya no está activa.' }, 401);
    c.set('cuentaId', cuentaId);
    await next();
  });
}

/** Tras 5 intentos fallidos desde la misma IP, esperar 1 minuto. */
export class LimiteIntentos {
  private fallos = new Map<string, { cuenta: number; hasta: number }>();
  constructor(
    private maximo = 5,
    private esperaMs = 60_000,
    private ahora = () => Date.now(),
  ) {}

  bloqueado(ip: string): boolean {
    const f = this.fallos.get(ip);
    if (!f) return false;
    if (f.hasta && f.hasta <= this.ahora()) {
      this.fallos.delete(ip);
      return false;
    }
    return f.cuenta >= this.maximo;
  }

  fallo(ip: string): void {
    const f = this.fallos.get(ip) ?? { cuenta: 0, hasta: 0 };
    f.cuenta += 1;
    if (f.cuenta >= this.maximo) f.hasta = this.ahora() + this.esperaMs;
    this.fallos.set(ip, f);
  }

  exito(ip: string): void {
    this.fallos.delete(ip);
  }
}
