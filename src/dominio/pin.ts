import type { Usuario } from './tipos';

// PIN: hash = SHA-256(sal + ':' + pin) en hexadecimal, sal aleatoria de 16 bytes por usuario (Web Crypto).

const aHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

export const esPinValido = (pin: string) => /^\d{4,6}$/.test(pin);

export function generarSal(): string {
  return aHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}:${pin}`);
  return aHex(await crypto.subtle.digest('SHA-256', datos));
}

export async function crearPin(pin: string): Promise<{ pinHash: string; pinSal: string }> {
  const pinSal = generarSal();
  return { pinHash: await hashPin(pin, pinSal), pinSal };
}

export async function verificarPin(
  pin: string,
  usuario: Pick<Usuario, 'pinHash' | 'pinSal'>,
): Promise<boolean> {
  return (await hashPin(pin, usuario.pinSal)) === usuario.pinHash;
}

/** El PIN identifica al usuario: regresa el usuario activo cuyo PIN coincide. */
export async function buscarUsuarioPorPin<U extends Pick<Usuario, 'pinHash' | 'pinSal' | 'activo'>>(
  usuarios: U[],
  pin: string,
): Promise<U | undefined> {
  if (!esPinValido(pin)) return undefined;
  for (const u of usuarios) {
    if (u.activo && (await verificarPin(pin, u))) return u;
  }
  return undefined;
}

/** ¿Otro usuario (activo o no) ya tiene este PIN? */
export async function pinEnUso(
  usuarios: Pick<Usuario, 'id' | 'pinHash' | 'pinSal'>[],
  pin: string,
  exceptoId?: string,
): Promise<boolean> {
  for (const u of usuarios) {
    if (u.id !== exceptoId && (await verificarPin(pin, u))) return true;
  }
  return false;
}

/** Bloqueo tras intentos fallidos: 5 intentos, espera de 30 s. */
export const INTENTOS_PIN = 5;
export const ESPERA_PIN_MS = 30_000;
