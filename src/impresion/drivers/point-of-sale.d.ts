// Tipos mínimos de @point-of-sale/webusb-receipt-printer y webbluetooth-receipt-printer (no traen tipos).

interface ConexionImpresoraPOS {
  type: 'usb' | 'bluetooth';
  language: string;
  codepageMapping: string;
  columns?: number;
  /** USB */
  serialNumber?: string;
  vendorId?: number;
  productId?: number;
  manufacturerName?: string;
  productName?: string;
  /** Bluetooth */
  id?: string;
  name?: string;
}

interface ImpresoraPOS {
  connect(): Promise<void>;
  reconnect(datos: unknown): Promise<void>;
  disconnect(): Promise<void>;
  print(datos: Uint8Array): Promise<void>;
  addEventListener(evento: 'connected', fn: (conexion: ConexionImpresoraPOS) => void): void;
  addEventListener(evento: 'disconnected', fn: () => void): void;
}

declare module '@point-of-sale/webusb-receipt-printer' {
  const WebUSBReceiptPrinter: { new (): ImpresoraPOS };
  export default WebUSBReceiptPrinter;
}

declare module '@point-of-sale/webbluetooth-receipt-printer' {
  const WebBluetoothReceiptPrinter: { new (): ImpresoraPOS };
  export default WebBluetoothReceiptPrinter;
}
