import type { TablaSync } from '../../src/dominio/tipos.js';

// Traducción entre registros del dominio (fechas ISO, opcionales ausentes) y filas de Drizzle
// (Date en columnas timestamptz, null en opcionales).

const CAMPOS_FECHA = new Set(['actualizadoEn', 'abiertoEn', 'cerradoEn', 'fecha', 'anuladoEn']);

/** Campos opcionales del dominio (en la base son NULL cuando no hay valor). */
const OPCIONALES: Partial<Record<TablaSync, string[]>> = {
  turnos: ['cerradoPor', 'cerradoEn', 'efectivoContado', 'conteo', 'resumen', 'nota'],
  movimientos: ['anuladoPor', 'anuladoEn'],
};

export function aFila(registro: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(registro).map(([k, v]) => [
      k,
      CAMPOS_FECHA.has(k) && typeof v === 'string' ? new Date(v) : v === undefined ? null : v,
    ]),
  );
}

export function aRegistro(tabla: TablaSync, fila: Record<string, unknown>): Record<string, unknown> {
  const opcionales = OPCIONALES[tabla] ?? [];
  const registro: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (k === 'rev' || k === 'borrado') continue;
    if (v === null && opcionales.includes(k)) continue;
    registro[k] = v instanceof Date ? v.toISOString() : v;
  }
  return registro;
}
