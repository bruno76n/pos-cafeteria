import { describe, expect, test } from 'vitest';
import { configPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { formatearDinero } from '@/dominio/dinero';
import { ticketAEscPos } from './escpos';
import { construirTicketVenta, type TicketDocumento } from './ticket';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
const contiene = (bytes: Uint8Array, secuencia: number[]) =>
  hex(bytes).includes(hex(Uint8Array.from(secuencia)));
const ascii = (t: string) => Array.from(t, (c) => c.charCodeAt(0));
const veces = (bytes: Uint8Array, secuencia: number[]) =>
  hex(bytes).split(hex(Uint8Array.from(secuencia))).length - 1;

const LF = [0x0a, 0x0d];
const CORTE = [0x1d, 0x56, 0x01];

const texto = (t: string): TicketDocumento => ({ columnas: 32, lineas: [{ tipo: 'texto', texto: t }] });

describe('ESC/POS', () => {
  test('acentos, ñ, ¡ y signo de pesos con la página de códigos CP437', () => {
    const bytes = ticketAEscPos(texto(`Café, Piña, Año, ¡Gracias! ${formatearDinero(123450)}`));
    expect(contiene(bytes, [0x1b, 0x40])).toBe(true); // ESC @
    expect(contiene(bytes, [0x1b, 0x74, 0x00])).toBe(true); // ESC t 0 (CP437)
    expect(contiene(bytes, [0x1b, 0x74, 0x02])).toBe(false); // no hace falta CP850
    expect(contiene(bytes, [0x43, 0x61, 0x66, 0x82, 0x2c])).toBe(true); // Café,
    expect(contiene(bytes, [0x50, 0x69, 0xa4, 0x61])).toBe(true); // Piña
    expect(contiene(bytes, [0x41, 0xa4, 0x6f])).toBe(true); // Año
    expect(contiene(bytes, [0xad, 0x47, 0x72])).toBe(true); // ¡Gr
    expect(contiene(bytes, ascii('$1,234.50'))).toBe(true);
  });

  test('mayúsculas acentuadas que no están en CP437 cambian a CP850', () => {
    const bytes = ticketAEscPos(texto('ÁNGEL'));
    expect(contiene(bytes, [0x1b, 0x74, 0x02, 0xb5, 0x4e])).toBe(true); // ESC t 2, Á
  });

  test('renglones alineados a 32 columnas', () => {
    const doc: TicketDocumento = {
      columnas: 32,
      lineas: [
        { tipo: 'texto', texto: 'CAFÉ', alineacion: 'centro' },
        { tipo: 'columnas', izquierda: 'TOTAL', derecha: '$1,234.50' },
        { tipo: 'separador' },
      ],
    };
    const bytes = ticketAEscPos(doc);
    expect(contiene(bytes, [...ascii(' '.repeat(14) + 'CAF'), 0x90, ...LF])).toBe(true);
    expect(contiene(bytes, [...ascii(`TOTAL${' '.repeat(18)}$1,234.50`), ...LF])).toBe(true);
    expect(contiene(bytes, [...ascii('-'.repeat(32)), ...LF])).toBe(true);
    expect(contiene(bytes, ascii('-'.repeat(33)))).toBe(false);
  });

  test('líneas de avance al final según la configuración', () => {
    const doc = texto('Fin');
    const sinAvance = ticketAEscPos(doc, { avance: 0 });
    expect(hex(sinAvance).endsWith(hex(Uint8Array.from([...ascii('Fin'), ...LF])))).toBe(true);
    const conAvance = ticketAEscPos(doc, { avance: 5 });
    expect(
      hex(conAvance).endsWith(hex(Uint8Array.from([...ascii('Fin'), ...Array(6).fill(LF).flat()]))),
    ).toBe(true);
    // Por defecto: 3 renglones.
    expect(ticketAEscPos(doc).length).toBe(sinAvance.length + 3 * LF.length);
  });

  test('el corte solo va si está activado, después del avance', () => {
    const doc = texto('Fin');
    expect(contiene(ticketAEscPos(doc), CORTE)).toBe(false);
    const conCorte = ticketAEscPos(doc, { avance: 2, cortar: true });
    expect(contiene(conCorte, [...LF, ...LF, ...CORTE])).toBe(true);
  });

  test('densidad: normal no manda nada; baja y alta mandan DC2 #', () => {
    const doc = texto('Fin');
    expect(contiene(ticketAEscPos(doc), [0x12, 0x23])).toBe(false);
    expect(contiene(ticketAEscPos(doc, { densidad: 'baja' }), [0x12, 0x23, 0x44])).toBe(true);
    expect(contiene(ticketAEscPos(doc, { densidad: 'alta' }), [0x12, 0x23, 0x4f])).toBe(true);
  });

  test('copias repiten el ticket completo', () => {
    const doc = texto('Fin');
    const una = ticketAEscPos(doc, { cortar: true });
    const dos = ticketAEscPos(doc, { cortar: true, copias: 2 });
    expect(dos.length).toBe(una.length * 2);
    expect(veces(dos, [0x1b, 0x40])).toBe(2);
    expect(veces(dos, CORTE)).toBe(2);
  });

  test('negrita, doble tamaño y QR nativo', () => {
    const doc: TicketDocumento = {
      columnas: 32,
      lineas: [
        { tipo: 'texto', texto: 'TOTAL', negrita: true },
        { tipo: 'texto', texto: 'Corte', doble: true },
        { tipo: 'qr', contenido: 'https://pos.example/t/1' },
      ],
    };
    const bytes = ticketAEscPos(doc);
    expect(contiene(bytes, [0x1b, 0x45, 0x01])).toBe(true); // ESC E 1
    expect(contiene(bytes, [0x1b, 0x45, 0x00])).toBe(true); // ESC E 0
    expect(contiene(bytes, [0x1d, 0x21, 0x11])).toBe(true); // GS ! doble
    expect(contiene(bytes, [0x1d, 0x28, 0x6b])).toBe(true); // GS ( k (QR)
  });

  test('logo en blanco y negro con ancho múltiplo de 8; sin logo sale solo el texto', () => {
    const logo = { width: 16, height: 8, data: new Uint8ClampedArray(16 * 8 * 4) };
    const doc: TicketDocumento = {
      columnas: 32,
      lineas: [
        { tipo: 'logo', dataUrl: 'data:image/png;base64,' },
        { tipo: 'texto', texto: 'CAFETERÍA DEMO' },
      ],
    };
    const conLogo = ticketAEscPos(doc, { logo });
    const sinLogo = ticketAEscPos(doc);
    expect(conLogo.length).toBeGreaterThan(sinLogo.length);
    expect(contiene(sinLogo, ascii('CAFETER'))).toBe(true);
  });

  test('un ticket de venta completo lleva sus renglones', () => {
    const bytes = ticketAEscPos(construirTicketVenta(ventaPrueba(), configPrueba));
    const texto = new TextDecoder('latin1').decode(bytes);
    expect(texto).toContain('Folio: A-000123');
    expect(texto).toContain('TOTAL                    $193.50');
  });
});
