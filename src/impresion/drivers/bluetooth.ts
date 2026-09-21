import { crearDriverDirecto } from './directa';

/** Web Bluetooth: Chrome en Android o computadora, solo impresoras Bluetooth Low Energy. */
export const driverBluetooth = crearDriverDirecto({
  tipo: 'bluetooth',
  nombre: 'Bluetooth',
  soportado: () => typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  cargar: async () => (await import('@point-of-sale/webbluetooth-receipt-printer')).default,
});
