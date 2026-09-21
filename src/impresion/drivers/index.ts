import { driverBluetooth } from './bluetooth';
import { driverNavegador } from './navegador';
import type { DriverImpresora, TipoImpresora } from './tipos';
import { driverUsb } from './usb';

export type { DriverImpresora, TipoImpresora } from './tipos';
export { ErrorImpresion } from './tipos';

export const DRIVERS: Record<TipoImpresora, DriverImpresora> = {
  navegador: driverNavegador,
  usb: driverUsb,
  bluetooth: driverBluetooth,
};

/** Solo las conexiones que este dispositivo soporta (el navegador siempre). */
export function driversDisponibles(): DriverImpresora[] {
  return Object.values(DRIVERS).filter((d) => d.soportado());
}
