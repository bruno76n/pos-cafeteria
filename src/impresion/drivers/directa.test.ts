import { describe, expect, test } from 'vitest';
import { configPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { construirTicketVenta } from '../ticket';
import { crearDriverDirecto } from './directa';

/** Imprime lo que recibe y anuncia la conexión como la librería real (evento asíncrono). */
function impresoraSimulada(opciones: { aceptaConexion: boolean }) {
  const impresos: Uint8Array[] = [];
  class Simulada implements ImpresoraPOS {
    private alConectar: ((c: ConexionImpresoraPOS) => void)[] = [];
    async connect() {
      if (opciones.aceptaConexion) this.anunciar();
    }
    async reconnect(datos: unknown) {
      if (opciones.aceptaConexion && (datos as { serialNumber?: string }).serialNumber === 'S1')
        this.anunciar();
    }
    async disconnect() {}
    async print(datos: Uint8Array) {
      impresos.push(datos);
    }
    addEventListener(evento: string, fn: (c: ConexionImpresoraPOS) => void) {
      if (evento === 'connected') this.alConectar.push(fn);
    }
    private anunciar() {
      const c: ConexionImpresoraPOS = {
        type: 'usb',
        language: 'esc-pos',
        codepageMapping: 'epson',
        serialNumber: 'S1',
        vendorId: 1208,
        productId: 3,
        manufacturerName: 'EPSON',
        productName: 'TM-T20',
      };
      for (const fn of this.alConectar) setTimeout(() => fn(c), 0);
    }
  }
  return { Simulada, impresos };
}

const doc = construirTicketVenta(ventaPrueba(), configPrueba);

describe('driver de impresión directa', () => {
  test('conectar espera el evento y guarda los datos para reconectar', async () => {
    const { Simulada, impresos } = impresoraSimulada({ aceptaConexion: true });
    const driver = crearDriverDirecto({
      tipo: 'usb',
      nombre: 'USB',
      soportado: () => true,
      cargar: async () => Simulada,
    });
    await expect(driver.imprimir(doc)).rejects.toThrow('La impresora no está conectada.');
    const datos = await driver.conectar();
    expect(datos).toMatchObject({ serialNumber: 'S1', language: 'esc-pos', nombre: 'EPSON TM-T20' });
    expect(driver.estado()).toBe('conectada');
    await driver.imprimir(doc);
    expect(impresos).toHaveLength(1);
    expect(new TextDecoder('latin1').decode(impresos[0])).toContain('Folio: A-000123');
  });

  test('reconectar con los datos guardados', async () => {
    const { Simulada } = impresoraSimulada({ aceptaConexion: true });
    const driver = crearDriverDirecto({
      tipo: 'usb',
      nombre: 'USB',
      soportado: () => true,
      cargar: async () => Simulada,
    });
    expect(await driver.reconectar(null)).toBe(false);
    expect(await driver.reconectar({ serialNumber: 'S1' })).toBe(true);
  });

  test('si no se elige impresora, error claro', async () => {
    const { Simulada } = impresoraSimulada({ aceptaConexion: false });
    const driver = crearDriverDirecto({
      tipo: 'usb',
      nombre: 'USB',
      soportado: () => true,
      cargar: async () => Simulada,
    });
    await expect(driver.conectar()).rejects.toThrow('No se conectó ninguna impresora.');
  }, 10_000);
});
