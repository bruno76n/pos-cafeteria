import type { ConfigImpresora, DispositivoImpresora } from '../configImpresora';
import type { TicketDocumento } from '../ticket';
import { crearEstado, ErrorImpresion, MENSAJES_IMPRESORA as M, type DriverImpresora } from './tipos';

// Web Bluetooth: Chrome en Android o computadora, con HTTPS (o localhost). Solo ve impresoras
// Bluetooth Low Energy; las de Bluetooth clásico se usan con RawBT.

/** Servicios seriales comunes de las impresoras térmicas BLE baratas. */
export const SERVICIOS_IMPRESORA = [
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

/** El navegador no expone el MTU: 20 bytes caben en cualquier conexión BLE. */
export const TAMANO_TROZO = 20;
/** Sin pausa entre trozos, el búfer de la impresora se llena y el ticket sale cortado. */
export const PAUSA_TROZO_MS = 20;
const ESPERA_RECONEXION_MS = 10_000;

interface Entorno {
  bluetooth: () => Bluetooth | undefined;
  esperar: (ms: number) => Promise<void>;
  bytes: (doc: TicketDocumento, config: ConfigImpresora) => Promise<Uint8Array>;
}

const entornoNavegador: Entorno = {
  bluetooth: () =>
    typeof navigator !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext
      ? navigator.bluetooth
      : undefined,
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  // El codificador ESC/POS (con sus páginas de códigos) solo se carga si se imprime directo.
  bytes: async (doc, config) => (await import('../escpos')).bytesDeTicket(doc, config),
};

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, rechazar) => setTimeout(() => rechazar(new Error('tiempo')), ms)),
  ]);
}

/** Característica donde se escriben los bytes: de preferencia la de escritura sin respuesta. */
async function buscarCaracteristica(servidor: BluetoothRemoteGATTServer) {
  const servicios = await servidor.getPrimaryServices().catch(() => []);
  let conRespuesta: BluetoothRemoteGATTCharacteristic | null = null;
  for (const servicio of servicios) {
    for (const c of await servicio.getCharacteristics().catch(() => [])) {
      if (c.properties.writeWithoutResponse) return c;
      if (c.properties.write) conRespuesta ??= c;
    }
  }
  return conRespuesta;
}

async function escribir(c: BluetoothRemoteGATTCharacteristic, trozo: Uint8Array<ArrayBuffer>) {
  if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse)
    return c.writeValueWithoutResponse(trozo);
  if (c.writeValueWithResponse) return c.writeValueWithResponse(trozo);
  return c.writeValue(trozo);
}

export function crearDriverBluetooth(entorno: Entorno = entornoNavegador): DriverImpresora {
  const estado = crearEstado('desconectada');
  let dispositivo: BluetoothDevice | null = null;
  let caracteristica: BluetoothRemoteGATTCharacteristic | null = null;

  const alDesconectar = () => {
    caracteristica = null;
    estado.cambiar('desconectada');
  };

  /** Conecta al GATT del dispositivo y localiza dónde escribir. */
  async function abrir(d: BluetoothDevice) {
    if (dispositivo !== d) {
      dispositivo?.removeEventListener('gattserverdisconnected', alDesconectar);
      d.addEventListener('gattserverdisconnected', alDesconectar);
      dispositivo = d;
    }
    if (!d.gatt) throw new ErrorImpresion(M.sinServicio, M.bluetoothClasico);
    const servidor = await d.gatt.connect();
    const c = await buscarCaracteristica(servidor);
    if (!c) {
      servidor.disconnect();
      throw new ErrorImpresion(M.sinServicio, M.bluetoothClasico);
    }
    caracteristica = c;
    estado.cambiar('conectada');
  }

  async function reconectar(config: ConfigImpresora) {
    if (caracteristica && dispositivo?.gatt?.connected) return true;
    const guardado = config.dispositivo;
    const bt = entorno.bluetooth();
    if (!guardado || !bt) return false;
    estado.cambiar('buscando');
    try {
      const d =
        dispositivo?.id === guardado.id
          ? dispositivo
          : (await bt.getDevices?.())?.find((x) => x.id === guardado.id);
      if (!d) throw new Error('sin permiso');
      await conLimite(abrir(d), ESPERA_RECONEXION_MS);
      return true;
    } catch {
      estado.cambiar('desconectada');
      return false;
    }
  }

  return {
    tipo: 'bluetooth',
    nombre: 'Bluetooth',
    soportado: () => Boolean(entorno.bluetooth()),
    estado: estado.obtener,
    suscribir: estado.suscribir,

    async conectar(): Promise<DispositivoImpresora> {
      const bt = entorno.bluetooth();
      if (!bt) throw new ErrorImpresion(M.noEncontrada, M.bluetoothClasico);
      estado.cambiar('buscando');
      try {
        const d = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICIOS_IMPRESORA });
        await abrir(d);
        return { id: d.id, nombre: d.name?.trim() || 'Impresora Bluetooth' };
      } catch (e) {
        estado.cambiar(caracteristica ? 'conectada' : 'desconectada');
        if (e instanceof ErrorImpresion) throw e;
        // NotFoundError: no apareció ninguna (o se cerró la lista sin elegir).
        if ((e as Error).name === 'NotFoundError')
          throw new ErrorImpresion(M.noEncontrada, M.bluetoothClasico);
        throw new ErrorImpresion(M.conexionPerdida);
      }
    },

    reconectar,

    async imprimir(doc, config) {
      if (!config.dispositivo) throw new ErrorImpresion(M.sinElegir);
      if (!(await reconectar(config)) || !caracteristica) throw new ErrorImpresion(M.conexionPerdida);
      const bytes = await entorno.bytes(doc, config);
      try {
        for (let i = 0; i < bytes.length; i += TAMANO_TROZO) {
          await escribir(caracteristica, bytes.slice(i, i + TAMANO_TROZO));
          await entorno.esperar(PAUSA_TROZO_MS);
        }
      } catch {
        alDesconectar();
        throw new ErrorImpresion(M.conexionPerdida);
      }
    },

    async olvidar(config) {
      const id = config.dispositivo?.id;
      const d =
        dispositivo ??
        (id ? (await entorno.bluetooth()?.getDevices?.())?.find((x) => x.id === id) : undefined);
      dispositivo = null;
      caracteristica = null;
      d?.removeEventListener('gattserverdisconnected', alDesconectar);
      if (d?.gatt?.connected) d.gatt.disconnect();
      await d?.forget?.().catch(() => undefined);
      estado.cambiar('desconectada');
    },
  };
}

export const driverBluetooth = crearDriverBluetooth();
