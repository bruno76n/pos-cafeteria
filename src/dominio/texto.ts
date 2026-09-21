/** Para buscar sin distinguir acentos ni mayúsculas: "Café" → "cafe". */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** ¿El texto contiene la búsqueda (sin acentos ni mayúsculas)? */
export function coincide(texto: string, busqueda: string): boolean {
  return normalizarBusqueda(texto).includes(normalizarBusqueda(busqueda));
}
