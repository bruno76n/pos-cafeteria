import ReceiptPrinterEncoder, { type ImageInput } from '@point-of-sale/receipt-printer-encoder';
import { renglonesDe, type TicketDocumento } from './ticket';

// Renderizador ESC/POS: bytes para impresoras térmicas (USB o Bluetooth).

/** Ancho del logo en puntos (múltiplo de 8): ~60 % del área imprimible (384 en 58 mm, 576 en 80 mm). */
export const anchoLogo = (columnas: 32 | 48) => (columnas === 48 ? 320 : 224);

export interface OpcionesEscPos {
  logo?: ImageInput & { width: number; height: number };
  /** Idioma y mapa de páginas de códigos que reporta la impresora al conectarse. */
  language?: string;
  codepageMapping?: string;
}

export function ticketAEscPos(doc: TicketDocumento, opciones: OpcionesEscPos = {}) {
  const e = new ReceiptPrinterEncoder({
    language: (opciones.language ?? 'esc-pos') as 'esc-pos',
    columns: doc.columnas,
    // Página de códigos elegida sola (CP437 cubre á é í ó ú ñ ¡ ¿).
    codepageMapping: (opciones.codepageMapping ?? 'epson') as 'epson',
    feedBeforeCut: 4,
  });
  e.initialize().codepage('auto');

  for (const linea of doc.lineas) {
    switch (linea.tipo) {
      case 'logo':
        if (opciones.logo) {
          const { width, height } = opciones.logo;
          e.align('center').image(opciones.logo, width, height, 'atkinson').align('left');
        }
        break;
      case 'qr':
        e.align('center').qrcode(linea.contenido, { model: 2, size: 6, errorlevel: 'm' }).align('left');
        break;
      case 'corte':
        e.cut('partial');
        break;
      default:
        for (const r of renglonesDe(linea, doc.columnas)) {
          if (r.negrita) e.bold(true);
          if (r.doble) e.size(2, 2);
          e.line(r.texto);
          if (r.doble) e.size(1, 1);
          if (r.negrita) e.bold(false);
        }
    }
  }
  return e.encode();
}

/** Carga el logo (data URL) en un canvas en blanco y negro con medidas múltiplo de 8. Solo navegador. */
export async function prepararLogo(dataUrl: string, anchoMaximo: number): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const ancho = Math.max(8, Math.floor(Math.min(anchoMaximo, img.naturalWidth) / 8) * 8);
  const alto = Math.max(8, Math.round((img.naturalHeight * ancho) / img.naturalWidth / 8) * 8);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar el logo.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(img, 0, 0, ancho, alto);
  return lienzo;
}
