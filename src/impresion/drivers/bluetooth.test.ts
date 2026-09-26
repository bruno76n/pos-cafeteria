import { describe, expect, test, vi } from 'vitest';
import { CONFIG_IMPRESORA_POR_DEFECTO, type ConfigImpresora } from '../configImpresora';
import type { TicketDocumento } from '../ticket';
import { crearDriverBluetooth, SERVICIOS_IMPRESORA, TAMANO_TROZO } from './bluetooth';
import { MENSAJES_IMPRESORA as M } from './tipos';

const doc: TicketDocumento = { columnas: 32, lineas: [{ tipo: 'texto', texto: 'Hola' }] };

/** Impresora BLE simulada: registra lo que se escribe y puede "apagarse". */
function impresoraSimulada(opciones: { conEscritura?: boolean; fallaAlEscribir?: boolean } = {}) {
  const { conEscritura = true, fallaAlEscribir = false } = opciones;
  const escritos: Uint8Array[] = [];
  const caracteristica: BluetoothRemoteGATTCharacteristic = {
    uuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    properties: { write: true, writeWithoutResponse: conEscritura },
    writeValueWithoutResponse: vi.fn(async (datos: BufferSource) => {
      if (fallaAlEscribir) throw new Error('GATT desconectado');
      escritos.push(new Uint8Array(datos as ArrayBuffer));
    }),
    writeValue: vi.fn(async () => {}),
  };
  const lectura: BluetoothRemoteGATTCharacteristic = {
    uuid: 'lectura',
    properties: { write: false, writeWithoutResponse: false },
    writeValue: vi.fn(async () => {}),
  };
  const dispositivo = new EventTarget() as BluetoothDevice;
  const servidor: BluetoothRemoteGATTServer = {
    connected: false,
    connect: vi.fn(async () => {
      servidor.connected = true;
      return servidor;
    }),
    disconnect: vi.fn(() => {
      servidor.connected = false;
    }),
    getPrimaryServices: vi.fn(async () => [
      {
        uuid: SERVICIOS_IMPRESORA[0]!,
        getCharacteristics: async () => (conEscritura ? [lectura, caracteristica] : [lectura]),
      },
    ]),
  };
  Object.assign(dispositivo, {
    id: 'BT-1',
    name: '58-LL thermal printer',
    gatt: servidor,
    forget: vi.fn(async () => {}),
  });
  const apagar = () => {
    servidor.connected = false;
    dispositivo.dispatchEvent(new Event('gattserverdisconnected'));
  };
  return { dispositivo, servidor, escritos, apagar };
}

function crear(
  bluetooth: Partial<Bluetooth> | undefined,
  bytes = Uint8Array.from({ length: 45 }, (_, i) => i),
) {
  const esperar = vi.fn(async () => {});
  const driver = crearDriverBluetooth({
    bluetooth: () => bluetooth as Bluetooth | undefined,
    esperar,
    bytes: async () => bytes,
  });
  return { driver, esperar, bytes };
}

const conImpresora = (id = 'BT-1'): ConfigImpresora => ({
  ...CONFIG_IMPRESORA_POR_DEFECTO,
  tipo: 'bluetooth',
  dispositivo: { id, nombre: '58-LL thermal printer' },
});

describe('driver Bluetooth', () => {
  test('sin Web Bluetooth no está soportado', () => {
    expect(crear(undefined).driver.soportado()).toBe(false);
  });

  test('buscar acepta todos los dispositivos con los servicios seriales comunes', async () => {
    const { dispositivo } = impresoraSimulada();
    const requestDevice = vi.fn(async () => dispositivo);
    const { driver } = crear({ requestDevice });
    const cambios: string[] = [];
    driver.suscribir(() => cambios.push(driver.estado()));

    expect(await driver.conectar()).toEqual({ id: 'BT-1', nombre: '58-LL thermal printer' });
    expect(requestDevice).toHaveBeenCalledWith({
      acceptAllDevices: true,
      optionalServices: expect.arrayContaining([
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ]),
    });
    expect(cambios).toEqual(['buscando', 'conectada']);
  });

  test('manda los bytes en trozos de 20 con pausa, a la característica sin respuesta', async () => {
    const { dispositivo, escritos } = impresoraSimulada();
    const { driver, esperar, bytes } = crear({ requestDevice: async () => dispositivo });
    await driver.conectar();
    await driver.imprimir(doc, conImpresora());
    expect(escritos.map((t) => t.length)).toEqual([TAMANO_TROZO, TAMANO_TROZO, 5]);
    expect(Uint8Array.from(escritos.flatMap((t) => [...t]))).toEqual(bytes);
    expect(esperar).toHaveBeenCalledTimes(3);
  });

  test('si no aparece ninguna, sugiere RawBT (Bluetooth clásico)', async () => {
    const noEncontrada = Object.assign(new Error('User cancelled'), { name: 'NotFoundError' });
    const { driver } = crear({
      requestDevice: async () => {
        throw noEncontrada;
      },
    });
    await expect(driver.conectar()).rejects.toMatchObject({
      message: M.noEncontrada,
      ayuda: M.bluetoothClasico,
    });
    expect(driver.estado()).toBe('desconectada');
  });

  test('sin característica de escritura: error claro y sugerencia de RawBT', async () => {
    const { dispositivo, servidor } = impresoraSimulada({ conEscritura: false });
    const { driver } = crear({ requestDevice: async () => dispositivo });
    await expect(driver.conectar()).rejects.toMatchObject({
      message: M.sinServicio,
      ayuda: M.bluetoothClasico,
    });
    expect(servidor.disconnect).toHaveBeenCalled();
  });

  test('al abrir la app reconecta con el id guardado (permisos persistentes)', async () => {
    const { dispositivo, escritos } = impresoraSimulada();
    const { driver } = crear({ requestDevice: vi.fn(), getDevices: async () => [dispositivo] });
    expect(await driver.reconectar(conImpresora('OTRA'))).toBe(false);
    expect(await driver.reconectar(conImpresora())).toBe(true);
    expect(driver.estado()).toBe('conectada');
    await driver.imprimir(doc, conImpresora());
    expect(escritos.length).toBeGreaterThan(0);
  });

  test('si se pierde la conexión, reconecta al imprimir; si no puede, avisa', async () => {
    const { dispositivo, servidor, apagar } = impresoraSimulada();
    const { driver } = crear({ requestDevice: async () => dispositivo });
    await driver.conectar();
    apagar();
    expect(driver.estado()).toBe('desconectada');
    await driver.imprimir(doc, conImpresora());
    expect(servidor.connect).toHaveBeenCalledTimes(2);

    apagar();
    vi.mocked(servidor.connect).mockRejectedValueOnce(new Error('fuera de alcance'));
    await expect(driver.imprimir(doc, conImpresora())).rejects.toThrow(M.conexionPerdida);
  });

  test('si falla a medio ticket, "Se perdió la conexión"', async () => {
    const { dispositivo } = impresoraSimulada({ fallaAlEscribir: true });
    const { driver } = crear({ requestDevice: async () => dispositivo });
    await driver.conectar();
    await expect(driver.imprimir(doc, conImpresora())).rejects.toThrow(M.conexionPerdida);
    expect(driver.estado()).toBe('desconectada');
  });

  test('sin impresora elegida pide buscarla', async () => {
    const { driver } = crear({ requestDevice: vi.fn() });
    await expect(driver.imprimir(doc, CONFIG_IMPRESORA_POR_DEFECTO)).rejects.toThrow(M.sinElegir);
  });

  test('olvidar desconecta y quita el permiso', async () => {
    const { dispositivo, servidor } = impresoraSimulada();
    const { driver } = crear({ requestDevice: async () => dispositivo });
    await driver.conectar();
    await driver.olvidar(conImpresora());
    expect(servidor.disconnect).toHaveBeenCalled();
    expect(dispositivo.forget).toHaveBeenCalled();
    expect(driver.estado()).toBe('desconectada');
  });
});
