import { crearDriverDirecto } from './directa';

/** WebUSB: Chrome en Android o computadora (en Windows el driver del sistema puede acaparar la impresora). */
export const driverUsb = crearDriverDirecto({
  tipo: 'usb',
  nombre: 'USB',
  soportado: () => typeof navigator !== 'undefined' && 'usb' in navigator,
  cargar: async () => (await import('@point-of-sale/webusb-receipt-printer')).default,
});
