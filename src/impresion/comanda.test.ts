import { describe, expect, test } from 'vitest';
import { configPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import type { ConfigGeneral, LineaVenta, Venta } from '@/dominio/tipos';
import { construirComanda, opcionesComanda, trabajosDeVenta } from './comanda';
import { ticketAEscPos } from './escpos';
import { construirTicketVenta, ticketATexto } from './ticket';

const base = ventaPrueba();
const [latte, brownie] = base.lineas as [LineaVenta, LineaVenta];

const crepa: LineaVenta = {
  ...latte,
  id: 'l-crepa',
  productoId: 'crepa-dulce',
  nombre: 'Crepa dulce',
  precioBase: 7500,
  tamano: { nombre: 'Grande', precio: 7500 },
  ingredientes: {
    nombres: ['Nutella', 'Plátano', 'Fresa', 'Nuez'],
    incluidos: 2,
    extras: 2,
    precioExtra: 500,
  },
  modificadores: [{ grupo: 'Extras', opcion: 'Helado', precioExtra: 1500 }],
  precioUnitario: 10000,
  cantidad: 2,
  nota: 'sin azúcar glass',
  importe: 20000,
  vaACocina: true,
};
const agua: LineaVenta = {
  ...brownie,
  id: 'l-agua',
  productoId: 'agua',
  nombre: 'Agua embotellada',
  nota: null,
  vaACocina: false,
};
const venta: Venta = { ...base, cliente: 'Luis', lineas: [crepa, latte, agua] };

/** Ningún importe: ni "$", ni cifras con centavos. */
const sinPrecios = (texto: string) => !/\$|\d+\.\d{2}\b/.test(texto);

describe('comanda de cocina', () => {
  test('encabezado, cliente, productos con su detalle y nota, sin precios', () => {
    const doc = construirComanda(venta, configPrueba)!;
    const texto = ticketATexto(doc);
    expect(texto.split('\n').every((r) => r.length <= 32)).toBe(true);
    expect(texto).toContain('COCINA');
    expect(texto).toContain('A-000123');
    expect(texto).toContain('Para: Luis');
    expect(texto).toContain('2x Crepa dulce');
    expect(texto).toContain('  Grande');
    expect(texto).toContain('  Nutella, Plátano, Fresa, Nuez');
    expect(texto).toContain('  Helado');
    expect(texto).toContain('>> NOTA: sin azúcar glass');
    expect(texto).toContain('2x Latte');
    expect(sinPrecios(texto)).toBe(true);
    expect(texto).not.toMatch(/TOTAL|Subtotal|IVA|RFC|Efectivo|Cambio/);
    expect(texto).toMatchSnapshot();
  });

  test('letra doble para lo que se lee de lejos y chica para cajero y caja', () => {
    const doc = construirComanda(venta, configPrueba)!;
    expect(doc.lineas).toContainEqual({
      tipo: 'texto',
      texto: 'COCINA',
      alineacion: 'centro',
      negrita: true,
      doble: true,
    });
    expect(doc.lineas).toContainEqual({ tipo: 'texto', texto: 'Para: Luis', negrita: true, doble: true });
    expect(doc.lineas).toContainEqual({ tipo: 'texto', texto: '2x Crepa dulce', negrita: true, doble: true });
    expect(doc.lineas).toContainEqual({ tipo: 'texto', texto: 'Ana · Caja 1', chica: true });
    // Separador entre producto y producto.
    expect(doc.lineas.filter((l) => l.tipo === 'separador')).toHaveLength(3);
  });

  test('los productos que no van a cocina no salen; el ticket del cliente sigue con todo', () => {
    const texto = ticketATexto(construirComanda(venta, configPrueba)!);
    expect(texto).not.toContain('Agua');
    expect(ticketATexto(construirTicketVenta(venta, configPrueba))).toContain('Agua embotellada');
  });

  test('una venta sin líneas de cocina no genera comanda', () => {
    expect(construirComanda({ ...venta, lineas: [agua] }, configPrueba)).toBeNull();
  });

  test('las ventas anteriores a "Va a cocina" cuentan como de cocina', () => {
    const { vaACocina: _, ...vieja } = crepa;
    expect(construirComanda({ ...venta, lineas: [vieja] }, configPrueba)).not.toBeNull();
  });

  test('reimpresión y comanda cancelada', () => {
    expect(ticketATexto(construirComanda(venta, configPrueba, { reimpresion: true })!)).toContain(
      '*** REIMPRESIÓN ***',
    );
    const cancelada = ticketATexto(construirComanda(venta, configPrueba, { cancelada: true })!);
    expect(cancelada).toContain('COMANDA');
    expect(cancelada).toContain('CANCELADA');
    expect(cancelada).toContain('A-000123');
    expect(cancelada).toContain('2x Crepa dulce');
    expect(sinPrecios(cancelada)).toBe(true);
  });

  test('en ESC/POS: avance y corte según la impresora, cajero en fuente B', () => {
    const doc = construirComanda(venta, configPrueba)!;
    const hex = Array.from(ticketAEscPos(doc, { avance: 3, cortar: true }), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join(' ');
    expect(hex).toContain('1b 4d 01'); // ESC M 1 (letra chica)
    expect(hex).toContain('0a 0d 0a 0d 0a 0d 1d 56 01'); // 3 de avance y corte
  });
});

describe('trabajos al cobrar', () => {
  const ticket = construirTicketVenta(venta, configPrueba);
  const conComanda = (comanda: ConfigGeneral['ticket']['comanda']): ConfigGeneral => ({
    ...configPrueba,
    ticket: { ...configPrueba.ticket, comanda },
  });

  test('por defecto: imprimir comanda, cocina primero, 1 copia', () => {
    expect(opcionesComanda(configPrueba.ticket)).toEqual({ imprimir: true, orden: 'cocina', copias: 1 });
    const trabajos = trabajosDeVenta(venta, configPrueba, ticket, 32);
    expect(trabajos.map((t) => t.tipo)).toEqual(['comanda', 'ticket']);
    expect(trabajos[0]?.copias).toBe(1);
  });

  test('cliente primero y copias de la comanda', () => {
    const trabajos = trabajosDeVenta(
      venta,
      conComanda({ imprimir: true, orden: 'cliente', copias: 2 }),
      ticket,
      32,
    );
    expect(trabajos.map((t) => [t.tipo, t.copias])).toEqual([
      ['ticket', undefined],
      ['comanda', 2],
    ]);
  });

  test('sin comanda si está apagada o si nada va a cocina', () => {
    expect(
      trabajosDeVenta(venta, conComanda({ imprimir: false, orden: 'cocina', copias: 1 }), ticket, 32),
    ).toEqual([{ tipo: 'ticket', doc: ticket }]);
    expect(trabajosDeVenta({ ...venta, lineas: [agua] }, configPrueba, ticket, 32)).toEqual([
      { tipo: 'ticket', doc: ticket },
    ]);
  });
});
