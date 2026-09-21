import { api, ErrorApi } from './api';
import { guardarMeta, leerMeta } from './bd';
import { motorSync } from './sync';

export const MENSAJE_PRIMER_INICIO_SIN_RED =
  'Necesitas internet para el primer inicio de sesión en este dispositivo.';

/**
 * Inicia sesión con la cuenta y guarda el token en Dexie. Si la sesión anterior había expirado,
 * la outbox sigue intacta y se sube en cuanto hay token nuevo.
 */
export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const anterior = await leerMeta('sesion');
  try {
    const { token, cuenta } = await api.acceso(correo.trim(), contrasena);
    await guardarMeta('sesion', { token, cuenta, expirada: false });
    void motorSync.sincronizar({ forzar: true });
    return { ok: true };
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error;
    if (error.tipo === 'red' && !error.status) {
      return {
        ok: false,
        error: anterior
          ? 'Sin conexión. Necesitas internet para volver a iniciar sesión.'
          : MENSAJE_PRIMER_INICIO_SIN_RED,
      };
    }
    return { ok: false, error: error.message };
  }
}
