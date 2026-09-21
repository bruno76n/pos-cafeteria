import { describe, expect, test } from 'vitest';
import { resumirTurno } from '@/dominio/caja';
import { configPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import type { ConfigGeneral, Turno } from '@/dominio/tipos';
import { construirTicketCorte, construirTicketVenta, envolver, ticketATexto } from './ticket';

const config: ConfigGeneral = {
  ...configPrueba,
  negocio: { ...configPrueba.negocio, direccion: 'Av. Juárez 123, Guadalajara' },
};
const venta = ventaPrueba();

describe('ticket de venta', () => {
  test('58 mm (32 columnas) como el ejemplo de la especificación', () => {
    const texto = ticketATexto(construirTicketVenta(venta, config));
    const renglones = texto.split('\n');
    expect(renglones.every((r) => r.length <= 32)).toBe(true);
    expect(renglones).toEqual(
      expect.arrayContaining([
        '         CAFETERÍA DEMO',
        '  Av. Juárez 123, Guadalajara',
        'Folio: A-000123',
        '19/09/2026 08:42          Caja 1',
        'Cajero: Ana',
        'Para: Luis',
        '2 Latte                  $170.00',
        '  2 x $85.00',
        '  Mediano 16 oz, Almendra',
        '1 Brownie                 $45.00',
        '  Nota: calientito',
        'Subtotal                 $215.00',
        'Descuento 10%            -$21.50',
        'TOTAL                    $193.50',
        'IVA incluido 16%          $26.69',
        'Efectivo recibido        $200.00',
        'Cambio                     $6.50',
        '    ¡Gracias por tu visita!',
      ]),
    );
    expect(texto).toMatchSnapshot();
  });

  test('80 mm (48 columnas)', () => {
    const texto = ticketATexto(
      construirTicketVenta(venta, { ...config, ticket: { ...config.ticket, ancho: 80 } }),
    );
    expect(texto.split('\n').every((r) => r.length <= 48)).toBe(true);
    expect(texto).toContain('TOTAL                                    $193.50');
    expect(texto).toMatchSnapshot();
  });

  test('reimpresión y venta cancelada', () => {
    const cancelada = ventaPrueba({
      estado: 'cancelada',
      cancelacion: {
        motivo: 'Cliente se arrepintió',
        usuario: { id: 'e', nombre: 'Encargada' },
        autorizadoPor: null,
        fecha: venta.fecha,
      },
    });
    const texto = ticketATexto(construirTicketVenta(cancelada, config, { reimpresion: true }));
    expect(texto).toContain('      *** REIMPRESIÓN ***');
    expect(texto).toContain('    *** VENTA CANCELADA ***');
    expect(texto).toContain('Cancelada: Cliente se arrepintió');
    expect(texto).toMatchSnapshot();
  });

  test('IVA no incluido, pagos combinados con referencia y campos ocultos', () => {
    const v = ventaPrueba({
      iva: { tasa: 0.16, incluido: false, base: 19350, monto: 3096 },
      total: 22446,
      cliente: null,
      pagos: [
        { metodo: 'tarjeta', monto: 12446, referencia: '4242' },
        { metodo: 'efectivo', monto: 10000, recibido: 10000 },
      ],
      cambio: 0,
    });
    const sinCajero = {
      ...config,
      ticket: { ...config.ticket, mostrarCajero: false, mostrarDireccion: false },
    };
    const texto = ticketATexto(construirTicketVenta(v, sinCajero));
    expect(texto).not.toContain('Cajero');
    expect(texto).not.toContain('Juárez');
    expect(texto).not.toContain('Para:');
    const renglones = texto.split('\n');
    expect(renglones.indexOf('IVA 16%                   $30.96')).toBeLessThan(
      renglones.indexOf('TOTAL                    $224.46'),
    );
    expect(texto).toContain('Tarjeta                  $124.46\n  Ref. 4242');
  });

  test('sin desglose de IVA', () => {
    const sinIVA = { ...config, ventas: { ...config.ventas, mostrarDesgloseIVA: false } };
    expect(ticketATexto(construirTicketVenta(venta, sinIVA))).not.toContain('IVA');
  });

  test('nombres largos se parten sin pasar del ancho', () => {
    const v = ventaPrueba({
      lineas: [{ ...venta.lineas[1]!, nombre: 'Croissant de jamón y queso con extra de todo' }],
    });
    const renglones = ticketATexto(construirTicketVenta(v, config)).split('\n');
    expect(renglones).toContain('1 Croissant de jamón y    $45.00');
    expect(renglones).toContain('  queso con extra de todo');
  });

  test('logo y QR como líneas del documento', () => {
    const conLogo = { ...config, negocio: { ...config.negocio, logo: 'data:image/png;base64,AAA' } };
    const doc = construirTicketVenta(venta, conLogo, { qr: 'https://pos.example/t/venta-b' });
    expect(doc.lineas[0]).toEqual({ tipo: 'logo', dataUrl: 'data:image/png;base64,AAA' });
    expect(doc.lineas).toContainEqual({ tipo: 'qr', contenido: 'https://pos.example/t/venta-b' });
    expect(doc.lineas.at(-1)).toEqual({ tipo: 'corte' });
  });
});

describe('ticket de corte', () => {
  const turno: Turno = {
    id: 'turno-1',
    dispositivoId: 'caja-1',
    dispositivoNombre: 'Caja 1',
    estado: 'cerrado',
    abiertoPor: { id: 'cajero', nombre: 'Ana' },
    abiertoEn: '2026-09-19T13:02:00.000Z',
    dia: '2026-09-19',
    fondoInicial: 50000,
    cerradoPor: { id: 'cajero', nombre: 'Ana' },
    cerradoEn: '2026-09-19T21:10:00.000Z',
    efectivoContado: 68000,
    actualizadoEn: '2026-09-19T21:10:00.000Z',
    nota: 'Faltó cambio',
  };
  const resumen = resumirTurno({
    turno,
    ventas: [venta],
    movimientos: [
      {
        id: 'm',
        turnoId: 'turno-1',
        dispositivoId: 'caja-1',
        tipo: 'gasto',
        categoria: 'Hielo',
        concepto: 'Bolsa',
        monto: 8000,
        usuario: { id: 'cajero', nombre: 'Ana' },
        fecha: '2026-09-19T15:00:00.000Z',
        dia: '2026-09-19',
        anulado: false,
        actualizadoEn: '2026-09-19T15:00:00.000Z',
      },
    ],
    devoluciones: [],
    contado: 68000,
  });

  test('resumen con diferencia', () => {
    const texto = ticketATexto(construirTicketCorte({ ...turno, resumen }, config));
    expect(texto).toContain('\n Corte de caja\n');
    expect(texto).toContain('Efectivo esperado        $613.50');
    expect(texto).toContain('Diferencia: Sobran        $66.50');
    expect(texto).toContain('  Hielo                   $80.00');
    expect(texto).toMatchSnapshot();
  });

  test('sin resumen no hay corte', () => {
    expect(() => construirTicketCorte(turno, config)).toThrow();
  });
});

test('envolver corta por palabras y palabras largas', () => {
  expect(envolver('uno dos tres', 7)).toEqual(['uno dos', 'tres']);
  expect(envolver('supercalifragilístico', 8)).toEqual(['supercal', 'ifragilí', 'stico']);
  expect(envolver('', 8)).toEqual(['']);
});
