import ReceiptPrinterEncoder, { type ImageInput } from '@point-of-sale/receipt-printer-encoder';
import type { ConfigImpresora, Densidad } from './configImpresora';
import { renglonesDe, type TicketDocumento } from './ticket';

// Renderizador ESC/POS: bytes para impresoras térmicas (Bluetooth directo o RawBT).

/** Ancho del logo en puntos (múltiplo de 8): ~60 % del área imprimible (384 en 58 mm, 576 en 80 mm). */
export const anchoLogo = (columnas: 32 | 48) => (columnas === 48 ? 320 : 224);

/**
 * DC2 # n (densidad de las impresoras térmicas genéricas): bits 0–4 densidad (50 % + 5 % × n),
 * bits 5–7 pausa. "Normal" no manda nada y deja lo que la impresora trae de fábrica.
 */
const DENSIDAD: Record<Densidad, number[]> = {
  baja: [0x12, 0x23, (2 << 5) | 4],
  normal: [],
  alta: [0x12, 0x23, (2 << 5) | 15],
};

export type OpcionesEscPos = Partial<Pick<ConfigImpresora, 'densidad' | 'avance' | 'cortar' | 'copias'>> & {
  logo?: ImageInput & { width: number; height: number };
};

export function ticketAEscPos(doc: TicketDocumento, opciones: OpcionesEscPos = {}): Uint8Array {
  const { densidad = 'normal', avance = 3, cortar = false, copias = 1 } = opciones;
  const e = new ReceiptPrinterEncoder({
    language: 'esc-pos',
    columns: doc.columnas,
    codepageMapping: 'epson',
    // Las impresoras genéricas de 58 mm traen CP437 (á é í ó ú ñ ¡ ¿) y CP850 (Á Í Ó Ú).
    codepageCandidates: ['cp437', 'cp850'],
    feedBeforeCut: 0,
  });
  e.initialize().raw(DENSIDAD[densidad]).codepage('auto');

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
      default:
        for (const r of renglonesDe(linea, doc.columnas)) {
          if (r.negrita) e.bold(true);
          if (r.doble) e.size(2, 2);
          if (r.chica) e.font('B');
          e.line(r.texto);
          if (r.chica) e.font('A');
          if (r.doble) e.size(1, 1);
          if (r.negrita) e.bold(false);
        }
    }
  }
  if (avance > 0) e.newline(avance);
  if (cortar) e.cut('partial');

  const uno = e.encode();
  const todas = new Uint8Array(uno.length * copias);
  for (let i = 0; i < copias; i++) todas.set(uno, i * uno.length);
  return todas;
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

/** Bytes listos para mandar: si el logo no carga, el ticket sale solo con el nombre del negocio. */
export async function bytesDeTicket(doc: TicketDocumento, config: ConfigImpresora): Promise<Uint8Array> {
  const lineaLogo = doc.lineas.find((l) => l.tipo === 'logo');
  const logo = lineaLogo
    ? await prepararLogo(lineaLogo.dataUrl, anchoLogo(doc.columnas)).catch(() => undefined)
    : undefined;
  return ticketAEscPos(doc, { ...config, logo });
}
