import { expect, test } from 'vitest';
import { configPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { documentoImpresion, ticketAHTML } from './html';
import { construirTicketVenta } from './ticket';

test('HTML del ticket: renglones, negritas y escapado', () => {
  const venta = ventaPrueba({ cliente: 'Luis <b>' });
  const html = ticketAHTML(construirTicketVenta(venta, configPrueba));
  expect(html).toContain('<div class="r n">Folio: A-000123</div>');
  expect(html).toContain('Para: Luis &lt;b&gt;');
  expect(html).not.toContain('<b>');
});

test('@page de 58 y 80 mm', () => {
  const doc58 = construirTicketVenta(ventaPrueba(), configPrueba);
  const doc80 = construirTicketVenta(ventaPrueba(), {
    ...configPrueba,
    ticket: { ...configPrueba.ticket, ancho: 80 },
  });
  expect(documentoImpresion(doc58)).toContain('@page { size: 58mm auto; margin: 0; }');
  expect(documentoImpresion(doc58)).toContain('width: 32ch;');
  expect(documentoImpresion(doc80)).toContain('@page { size: 80mm auto; margin: 0; }');
  expect(documentoImpresion(doc80)).toContain('width: 48ch;');
});

test('QR como SVG dentro del ticket', () => {
  const doc = construirTicketVenta(ventaPrueba(), configPrueba, { qr: 'https://pos.example/t/venta-b' });
  expect(ticketAHTML(doc)).toMatch(/<div class="qr"><svg[^>]*>/);
});
