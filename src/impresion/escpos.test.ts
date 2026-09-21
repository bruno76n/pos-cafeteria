import { describe, expect, test } from 'vitest';
import { configPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { ticketAEscPos } from './escpos';
import { construirTicketVenta, type TicketDocumento } from './ticket';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
const contiene = (bytes: Uint8Array, secuencia: number[]) =>
  hex(bytes).includes(hex(Uint8Array.from(secuencia)));

describe('ESC/POS', () => {
  test('inicializa y elige una página de códigos con acentos', () => {
    const doc: TicketDocumento = {
      columnas: 32,
      lineas: [{ tipo: 'texto', texto: 'Café, Piña, Año, ¡Gracias!' }],
    };
    const bytes = ticketAEscPos(doc);
    expect(contiene(bytes, [0x1b, 0x40])).toBe(true); // ESC @
    expect(contiene(bytes, [0x1b, 0x74, 0x00])).toBe(true); // ESC t 0 (CP437)
    // "Caf" é "," ... "Pi" ñ "a" ... ¡
    expect(contiene(bytes, [0x43, 0x61, 0x66, 0x82])).toBe(true);
    expect(contiene(bytes, [0x50, 0x69, 0xa4, 0x61])).toBe(true);
    expect(contiene(bytes, [0x41, 0xa4, 0x6f])).toBe(true);
    expect(contiene(bytes, [0xad, 0x47, 0x72])).toBe(true);
  });

  test('negrita, doble tamaño, QR nativo y corte', () => {
    const doc: TicketDocumento = {
      columnas: 32,
      lineas: [
        { tipo: 'texto', texto: 'TOTAL', negrita: true },
        { tipo: 'texto', texto: 'Corte', doble: true },
        { tipo: 'qr', contenido: 'https://pos.example/t/1' },
        { tipo: 'corte' },
      ],
    };
    const bytes = ticketAEscPos(doc);
    expect(contiene(bytes, [0x1b, 0x45, 0x01])).toBe(true); // ESC E 1
    expect(contiene(bytes, [0x1b, 0x45, 0x00])).toBe(true); // ESC E 0
    expect(contiene(bytes, [0x1d, 0x21, 0x11])).toBe(true); // GS ! doble
    expect(contiene(bytes, [0x1d, 0x28, 0x6b])).toBe(true); // GS ( k (QR)
    expect(contiene(bytes, [0x1d, 0x56, 0x01])).toBe(true); // GS V corte parcial
  });

  test('logo en blanco y negro con ancho múltiplo de 8', () => {
    const logo = { width: 16, height: 8, data: new Uint8ClampedArray(16 * 8 * 4) };
    const doc: TicketDocumento = {
      columnas: 32,
      lineas: [{ tipo: 'logo', dataUrl: 'data:image/png;base64,' }],
    };
    expect(ticketAEscPos(doc, { logo }).length).toBeGreaterThan(ticketAEscPos(doc).length);
  });

  test('un ticket de venta completo lleva sus renglones', () => {
    const bytes = ticketAEscPos(construirTicketVenta(ventaPrueba(), configPrueba));
    const texto = new TextDecoder('latin1').decode(bytes);
    expect(texto).toContain('Folio: A-000123');
    expect(texto).toContain('TOTAL                    $193.50');
  });
});
