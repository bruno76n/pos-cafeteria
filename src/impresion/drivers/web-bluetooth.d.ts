// Tipos mínimos de Web Bluetooth (TypeScript no los incluye en lib.dom).

interface BluetoothCharacteristicProperties {
  write: boolean;
  writeWithoutResponse: boolean;
}

interface BluetoothRemoteGATTCharacteristic {
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  writeValueWithoutResponse?(datos: BufferSource): Promise<void>;
  writeValueWithResponse?(datos: BufferSource): Promise<void>;
  writeValue(datos: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  uuid: string;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  /** Chrome 101+: quita el permiso guardado. */
  forget?(): Promise<void>;
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  optionalServices?: (string | number)[];
}

interface Bluetooth {
  requestDevice(opciones: RequestDeviceOptions): Promise<BluetoothDevice>;
  /** Dispositivos con permiso persistente (Chrome con el backend nuevo de permisos). */
  getDevices?(): Promise<BluetoothDevice[]>;
}

interface Navigator {
  readonly bluetooth?: Bluetooth;
}
