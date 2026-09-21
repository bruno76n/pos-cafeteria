/** Tamaño máximo de una imagen guardada dentro de un registro (data URL). */
export const MAXIMO_BYTES_IMAGEN = 60 * 1024;

const bytesDeDataUrl = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/**
 * Reduce la imagen y la comprime en WebP (JPEG si el navegador no codifica WebP, como Safari)
 * bajando la calidad hasta quedar en ~60 KB.
 * - `cuadrado`: recorta al centro en `lado`×`lado` (productos).
 * - si no: conserva la proporción con `lado` como ancho máximo, sobre fondo blanco (logo).
 */
export async function comprimirImagen(archivo: Blob, opciones: { lado?: number; cuadrado?: boolean } = {}) {
  const { lado = 256, cuadrado = true } = opciones;
  const mapa = await createImageBitmap(archivo);
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  if (cuadrado) {
    const corte = Math.min(mapa.width, mapa.height);
    lienzo.width = lado;
    lienzo.height = lado;
    ctx.drawImage(mapa, (mapa.width - corte) / 2, (mapa.height - corte) / 2, corte, corte, 0, 0, lado, lado);
  } else {
    const escala = Math.min(1, lado / mapa.width);
    lienzo.width = Math.max(1, Math.round(mapa.width * escala));
    lienzo.height = Math.max(1, Math.round(mapa.height * escala));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  }
  mapa.close();

  for (const calidad of [0.85, 0.7, 0.55, 0.4, 0.3]) {
    let resultado = lienzo.toDataURL('image/webp', calidad);
    if (!resultado.startsWith('data:image/webp')) resultado = lienzo.toDataURL('image/jpeg', calidad);
    if (bytesDeDataUrl(resultado) <= MAXIMO_BYTES_IMAGEN) return resultado;
  }
  throw new Error('La imagen es demasiado pesada. Prueba con otra.');
}
