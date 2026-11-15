import { describe, expect, test } from 'vitest';
import { configPrueba, cuentaPrueba, pedidoPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import type { ConfigGeneral, LineaVenta, Venta } from '@/dominio/tipos';
import {
  construirComanda,
  datosDeCuenta,
  datosDePedido,
  datosDeVenta,
  opcionesComanda,
  trabajosDeCobro,
  trabajosDePedido,
  trabajosDeVentaRapida,
} from './comanda';
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
    const doc = construirComanda(datosDeVenta(venta), configPrueba)!;
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
    const doc = construirComanda(datosDeVenta(venta), configPrueba)!;
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
    const texto = ticketATexto(construirComanda(datosDeVenta(venta), configPrueba)!);
    expect(texto).not.toContain('Agua');
    expect(ticketATexto(construirTicketVenta(venta, configPrueba))).toContain('Agua embotellada');
  });

  test('una venta sin líneas de cocina no genera comanda', () => {
    expect(construirComanda(datosDeVenta({ ...venta, lineas: [agua] }), configPrueba)).toBeNull();
  });

  test('las ventas anteriores a "Va a cocina" cuentan como de cocina', () => {
    const { vaACocina: _, ...vieja } = crepa;
    expect(construirComanda(datosDeVenta({ ...venta, lineas: [vieja] }), configPrueba)).not.toBeNull();
  });

  test('reimpresión y comanda cancelada', () => {
    expect(
      ticketATexto(construirComanda(datosDeVenta(venta), configPrueba, { reimpresion: true })!),
    ).toContain('*** REIMPRESIÓN ***');
    const cancelada = ticketATexto(construirComanda(datosDeVenta(venta), configPrueba, { cancelada: true })!);
    expect(cancelada).toContain('COMANDA');
    expect(cancelada).toContain('CANCELADA');
    expect(cancelada).toContain('A-000123');
    expect(cancelada).toContain('2x Crepa dulce');
    expect(sinPrecios(cancelada)).toBe(true);
  });

  test('en ESC/POS: avance y corte según la impresora, cajero en fuente B', () => {
    const doc = construirComanda(datosDeVenta(venta), configPrueba)!;
    const hex = Array.from(ticketAEscPos(doc, { avance: 3, cortar: true }), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join(' ');
    expect(hex).toContain('1b 4d 01'); // ESC M 1 (letra chica)
    expect(hex).toContain('0a 0d 0a 0d 0a 0d 1d 56 01'); // 3 de avance y corte
  });
});

describe('trabajos de la venta rápida', () => {
  const ticket = construirTicketVenta(venta, configPrueba);
  const conComanda = (comanda: ConfigGeneral['ticket']['comanda']): ConfigGeneral => ({
    ...configPrueba,
    ticket: { ...configPrueba.ticket, comanda },
  });

  test('por defecto: imprimir comanda, cocina primero, 1 copia', () => {
    expect(opcionesComanda(configPrueba.ticket)).toEqual({ imprimir: true, orden: 'cocina', copias: 1 });
    const trabajos = trabajosDeVentaRapida(datosDeVenta(venta), configPrueba, ticket, 32);
    expect(trabajos.map((t) => t.tipo)).toEqual(['comanda', 'ticket']);
    expect(trabajos[0]?.copias).toBe(1);
  });

  test('cliente primero y copias de la comanda', () => {
    const trabajos = trabajosDeVentaRapida(
      datosDeVenta(venta),
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
      trabajosDeVentaRapida(
        datosDeVenta(venta),
        conComanda({ imprimir: false, orden: 'cocina', copias: 1 }),
        ticket,
        32,
      ),
    ).toEqual([{ tipo: 'ticket', doc: ticket }]);
    expect(
      trabajosDeVentaRapida(datosDeVenta({ ...venta, lineas: [agua] }), configPrueba, ticket, 32),
    ).toEqual([{ tipo: 'ticket', doc: ticket }]);
  });
});

describe('trabajos por separado', () => {
  const ticket = construirTicketVenta(venta, configPrueba);

  test('el pedido solo manda su comanda, con las copias configuradas', () => {
    const trabajos = trabajosDePedido(datosDeVenta(venta), configPrueba, 32);
    expect(trabajos.map((t) => [t.tipo, t.copias])).toEqual([['comanda', 1]]);
    expect(trabajosDePedido(datosDeVenta({ ...venta, lineas: [agua] }), configPrueba, 32)).toEqual([]);
  });

  test('el cobro solo manda el ticket del cliente', () => {
    expect(trabajosDeCobro(ticket)).toEqual([{ tipo: 'ticket', doc: ticket }]);
  });
});

describe('comanda por pedido', () => {
  const cuenta = cuentaPrueba();
  const pedido1 = pedidoPrueba({ id: 'p1', numero: 1, lineas: [crepa, agua] });
  const pedido2 = pedidoPrueba({
    id: 'p2',
    numero: 2,
    fecha: '2026-09-19T14:55:00.000Z',
    lineas: [{ ...latte, cantidad: 1, importe: 8500 }],
  });
  const anulacion = pedidoPrueba({
    id: 'p3',
    numero: 3,
    tipo: 'anulacion',
    fecha: '2026-09-19T15:02:00.000Z',
    lineas: [{ ...crepa, cantidad: 1, importe: 10000, comanda: 1 }],
  });
  const texto = (datos: ReturnType<typeof datosDePedido>, opciones = {}) =>
    ticketATexto(construirComanda(datos, configPrueba, opciones)!);

  test('pedido 1: cuenta y comanda, solo sus productos de cocina', () => {
    const t = texto(datosDePedido(cuenta, pedido1));
    expect(t).toContain('Cuenta 12\n');
    expect(t).toContain('Comanda 1\n');
    expect(t).toContain('Para: Luis');
    expect(t).toContain('2x Crepa dulce');
    expect(t).not.toContain('Agua');
    expect(t).not.toContain('Latte');
    expect(t).not.toContain(' de ');
    expect(sinPrecios(t)).toBe(true);
    expect(t).toMatchSnapshot();
  });

  test('pedido 2: solo lo nuevo, con su hora', () => {
    const t = texto(datosDePedido(cuenta, pedido2));
    expect(t).toContain('Cuenta 12\n');
    expect(t).toContain('Comanda 2\n');
    expect(t).toContain('1x Latte');
    expect(t).not.toContain('Crepa');
    expect(t).toMatchSnapshot();
  });

  test('anulación: avisa que no se prepare y de qué comanda sale', () => {
    const t = texto(datosDePedido(cuenta, anulacion), { anulacion: true });
    expect(t).toContain('ANULACIÓN');
    expect(t).toContain('NO PREPARAR');
    expect(t).toContain('Cuenta 12\n');
    expect(t).toContain('Comanda 3\n');
    expect(t).toContain('1x Crepa dulce');
    expect(t).toContain('(de la comanda 1)');
    expect(t).not.toContain('COCINA');
    expect(t).toMatchSnapshot();
  });

  test('reimpresión: "Comanda 2 de 3" y la marca', () => {
    const t = texto(datosDePedido(cuenta, pedido2, { totalPedidos: 3 }), { reimpresion: true });
    expect(t).toContain('Cuenta 12\n');
    expect(t).toContain('Comanda 2 de 3\n');
    expect(t).toContain('*** REIMPRESIÓN ***');
    expect(t).toMatchSnapshot();
  });

  test('la caja desde donde se envía manda sobre la que abrió la cuenta', () => {
    expect(datosDePedido(cuenta, pedido1).dispositivoNombre).toBe('Caja 1');
    expect(datosDePedido(cuenta, pedido1, { dispositivoNombre: 'Caja 2' }).dispositivoNombre).toBe('Caja 2');
    expect(datosDePedido(cuenta, pedido1).cajero).toBe('Ana');
  });

  test('un pedido sin productos de cocina no genera comanda', () => {
    const soloAgua = pedidoPrueba({ lineas: [agua] });
    expect(construirComanda(datosDePedido(cuenta, soloAgua), configPrueba)).toBeNull();
    expect(trabajosDePedido(datosDePedido(cuenta, soloAgua), configPrueba, 32)).toEqual([]);
  });

  test('sin nombre no hay "Para:"', () => {
    const t = texto(datosDePedido({ ...cuenta, nombre: null }, pedido1));
    expect(t).not.toContain('Para:');
  });

  test('cuenta cancelada: aviso con la cuenta y lo que se había enviado', () => {
    const cancelada = cuentaPrueba({
      estado: 'cancelada',
      cancelacion: {
        motivo: 'Se fue',
        usuario: { id: 'enc', nombre: 'Encargada' },
        autorizadoPor: null,
        fecha: '2026-09-19T15:10:00.000Z',
      },
    });
    const t = texto(datosDeCuenta(cancelada, [{ ...crepa, cantidad: 2 }]), { cancelada: true });
    expect(t).toContain('CANCELADA');
    expect(t).toContain('NO PREPARAR');
    expect(t).toContain('Cuenta 12');
    expect(t).not.toContain('Comanda 1');
    expect(t).toContain('Encargada · Caja 1');
    expect(t).toContain('2x Crepa dulce');
    expect(sinPrecios(t)).toBe(true);
    expect(t).toMatchSnapshot();
  });
});
