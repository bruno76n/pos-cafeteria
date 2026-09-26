import type { TipoImpresora } from '../configImpresora';
import { driverBluetooth } from './bluetooth';
import { driverRawBT } from './rawbt';
import { driverSistema } from './sistema';
import type { DriverImpresora } from './tipos';

export type { DriverImpresora, EstadoConexion, TipoImpresora } from './tipos';
export { ErrorImpresion, MENSAJES_IMPRESORA } from './tipos';

export const DRIVERS: Record<TipoImpresora, DriverImpresora> = {
  bluetooth: driverBluetooth,
  rawbt: driverRawBT,
  sistema: driverSistema,
};

/** Solo las conexiones que este dispositivo soporta (el diálogo del sistema siempre). */
export function driversDisponibles(): DriverImpresora[] {
  return Object.values(DRIVERS).filter((d) => d.soportado());
}

/** El driver elegido, o el del sistema si este dispositivo no lo soporta. */
export function driverDe(tipo: TipoImpresora): DriverImpresora {
  const elegido = DRIVERS[tipo];
  return elegido.soportado() ? elegido : driverSistema;
}
