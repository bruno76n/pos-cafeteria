/** Dinero siempre en centavos enteros. Solo se formatea al mostrar. */
export type Centavos = number;

/** Redondea al entero más cercano; las mitades hacia arriba. Tolera el ruido de punto flotante. */
export function redondear(valor: number): number {
  const limpio = Math.round(valor * 1e6) / 1e6;
  return Math.sign(limpio) * Math.floor(Math.abs(limpio) + 0.5);
}

export function pesos(cantidad: number): Centavos {
  return redondear(cantidad * 100);
}

const formato = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** 19350 → "$193.50"; -2150 → "-$21.50". */
export function formatearDinero(centavos: Centavos): string {
  return formato.format((centavos || 0) / 100); // || 0 evita "-$0.00" con -0
}

/** Formato corto para botones de billetes: 20000 → "$200"; 1250 → "$12.50". */
export function formatearDineroCorto(centavos: Centavos): string {
  return centavos % 100 === 0
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(
        centavos / 100,
      )
    : formatearDinero(centavos);
}

/**
 * Lee lo que el usuario captura ("12.5", "$1,200", "0.50") y regresa centavos.
 * Regresa null si no es un monto válido (vacío, negativo, más de 2 decimales).
 */
export function leerCaptura(texto: string): Centavos | null {
  const limpio = texto.trim().replace(/[$\s,]/g, '');
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(limpio)) return null;
  const [enteros = '0', decimales = ''] = limpio.split('.');
  return Number(enteros || '0') * 100 + Number(decimales.padEnd(2, '0'));
}

/** Centavos a texto editable: 1250 → "12.50"; 1200 → "12". */
export function aTextoCaptura(centavos: Centavos): string {
  return centavos % 100 === 0 ? String(centavos / 100) : (centavos / 100).toFixed(2);
}

export function esCentavos(valor: unknown): valor is Centavos {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}
