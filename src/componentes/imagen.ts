/** Tamaño máximo de la imagen guardada dentro del registro (data URL). */
export const MAXIMO_BYTES_IMAGEN = 60 * 1024;

const bytesDeDataUrl = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/**
 * Recorta al centro en cuadrado, reduce a `lado`×`lado` y comprime en WebP (JPEG si el navegador
 * no codifica WebP, como Safari) bajando la calidad hasta quedar en ~60 KB.
 */
export async function comprimirImagen(archivo: Blob, lado = 256): Promise<string> {
  const mapa = await createImageBitmap(archivo);
  const corte = Math.min(mapa.width, mapa.height);
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(mapa, (mapa.width - corte) / 2, (mapa.height - corte) / 2, corte, corte, 0, 0, lado, lado);
  mapa.close();

  for (const calidad of [0.85, 0.7, 0.55, 0.4, 0.3]) {
    let resultado = lienzo.toDataURL('image/webp', calidad);
    if (!resultado.startsWith('data:image/webp')) resultado = lienzo.toDataURL('image/jpeg', calidad);
    if (bytesDeDataUrl(resultado) <= MAXIMO_BYTES_IMAGEN) return resultado;
  }
  throw new Error('La imagen es demasiado pesada. Prueba con otra.');
}
