import type { Dispositivo } from './tipos';

/** A + 123 → "A-000123" */
export function formatearFolio(prefijo: string, numero: number): string {
  return `${prefijo}-${numero.toString().padStart(6, '0')}`;
}

export function leerFolio(folio: string): { prefijo: string; numero: number } | null {
  const m = /^([A-Z])-(\d+)$/.exec(folio);
  return m ? { prefijo: m[1]!, numero: Number(m[2]) } : null;
}

/** Siguiente folio del dispositivo (se asigna en la misma transacción que guarda la venta). */
export function siguienteFolio(dispositivo: Pick<Dispositivo, 'prefijo' | 'ultimoFolio'>): {
  folio: string;
  numero: number;
} {
  if (!dispositivo.prefijo) throw new Error('Este dispositivo no tiene prefijo de folio.');
  const numero = dispositivo.ultimoFolio + 1;
  return { folio: formatearFolio(dispositivo.prefijo, numero), numero };
}

/** Al configurar: el mayor entre el contador del servidor y el folio más alto con ese prefijo. */
export function contadorInicial(prefijo: string, ultimoDelServidor: number, folios: string[]): number {
  return folios.reduce((max, f) => {
    const l = leerFolio(f);
    return l && l.prefijo === prefijo ? Math.max(max, l.numero) : max;
  }, ultimoDelServidor);
}

export const esPrefijoValido = (prefijo: string) => /^[A-Z]$/.test(prefijo);

/** Otro dispositivo de caja que ya usa el prefijo, si lo hay. */
export function prefijoEnUso(
  prefijo: string,
  dispositivos: Pick<Dispositivo, 'id' | 'nombre' | 'prefijo'>[],
  miId: string,
): Pick<Dispositivo, 'id' | 'nombre' | 'prefijo'> | undefined {
  return dispositivos.find((d) => d.id !== miId && d.prefijo === prefijo);
}
