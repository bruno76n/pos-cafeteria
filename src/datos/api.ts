import type { RangoDias } from '@/dominio/fechas';
import type { DatosReporte } from '@/dominio/reportes';
import type {
  ConfigTicket,
  Operacion,
  RespuestaAcceso,
  RespuestaPull,
  RespuestaPush,
  Venta,
} from '@/dominio/tipos';

// Cliente HTTP de la API. Solo lo usan el motor de sync, el login, Reportes fuera de rango y el
// ticket digital público.

const BASE = import.meta.env.VITE_API_URL || '/api';

/** red: sin conexión, timeout o 5xx (se reintenta). sesion: 401. peticion: otro 4xx. */
export class ErrorApi extends Error {
  constructor(
    readonly tipo: 'red' | 'sesion' | 'peticion',
    mensaje: string,
    readonly status?: number,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/** Ticket digital público (enlace del QR). */
export interface TicketPublico {
  venta: Venta;
  config: ConfigTicket;
}

/** Lo que el motor de sync necesita de la red (se reemplaza en pruebas). */
export interface ClienteApi {
  push(token: string, operaciones: Operacion[]): Promise<RespuestaPush>;
  pull(token: string, desde: number): Promise<RespuestaPull>;
}

async function pedir<T>(
  ruta: string,
  opciones: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { token, timeoutMs = 20_000, ...init } = opciones;
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ErrorApi('red', 'Sin conexión con el servidor.');
  }
  const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null;
  if (res.ok) return cuerpo as T;
  const mensaje = cuerpo?.error ?? `Error ${res.status}`;
  if (res.status === 401) throw new ErrorApi('sesion', mensaje, 401);
  if (res.status >= 500 || res.status === 429 || res.status === 408)
    throw new ErrorApi('red', mensaje, res.status);
  throw new ErrorApi('peticion', mensaje, res.status);
}

export const api = {
  acceso: (correo: string, contrasena: string) =>
    pedir<RespuestaAcceso>('/acceso', { method: 'POST', body: JSON.stringify({ correo, contrasena }) }),
  push: (token: string, operaciones: Operacion[]) =>
    pedir<RespuestaPush>('/sync/push', { method: 'POST', token, body: JSON.stringify({ operaciones }) }),
  pull: (token: string, desde: number) => pedir<RespuestaPull>(`/sync/pull?desde=${desde}`, { token }),
  reportes: (token: string, rango: RangoDias) =>
    pedir<DatosReporte>(`/reportes?desde=${rango.desde}&hasta=${rango.hasta}`, { token, timeoutMs: 60_000 }),
  salud: () => pedir<{ ok: boolean }>('/salud', { timeoutMs: 5_000 }),
  ticketPublico: (id: string) => pedir<TicketPublico>(`/tickets/${encodeURIComponent(id)}`),
} satisfies ClienteApi & Record<string, unknown>;
