import type { Centavos } from './dinero';

export type Celda = string | number | null;

const BOM = '﻿';

function celda(valor: Celda): string {
  if (valor === null) return '';
  const texto = String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV en UTF-8 con BOM (Excel respeta acentos), separado por comas y con saltos CRLF. */
export function aCSV(encabezados: string[], filas: Celda[][]): string {
  return BOM + [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n';
}

/** Centavos como número decimal para hojas de cálculo: 19350 → "193.50". */
export const pesosCSV = (centavos: Centavos) => (centavos / 100).toFixed(2);
