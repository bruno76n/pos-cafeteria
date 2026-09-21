/** Mueve un elemento una posición y renumera `orden` (1, 2, 3…). Regresa solo los que cambiaron. */
export function mover<T extends { id: string; orden: number }>(lista: T[], id: string, delta: -1 | 1): T[] {
  const ordenada = [...lista].sort((a, b) => a.orden - b.orden);
  const i = ordenada.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ordenada.length) return [];
  [ordenada[i], ordenada[j]] = [ordenada[j]!, ordenada[i]!];
  return ordenada.flatMap((x, k) => (x.orden === k + 1 ? [] : [{ ...x, orden: k + 1 }]));
}

/** Orden para un elemento nuevo: al final. */
export const siguienteOrden = (lista: { orden: number }[]) => Math.max(0, ...lista.map((x) => x.orden)) + 1;
