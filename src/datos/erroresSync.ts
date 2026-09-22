import { bd } from './bd';
import { motorSync, type MotorSync } from './sync';

// Operaciones rechazadas por el servidor: se guardan aparte para no bloquear la cola y
// se avisa al Administrador con el folio y la opción de reintentar.

/** Folio o descripción del registro para el aviso ("La venta A-000123 no se pudo subir."). */
export function describirError(error: {
  tabla: string;
  datos: Record<string, unknown>;
  registroId: string;
}): string {
  if (error.tabla === 'ventas' && typeof error.datos.folio === 'string')
    return `La venta ${error.datos.folio}`;
  if (error.tabla === 'ventas') return 'Una venta';
  const nombre = typeof error.datos.nombre === 'string' ? ` «${error.datos.nombre}»` : '';
  const tipos: Record<string, string> = {
    movimientos: 'Un movimiento de caja',
    devoluciones: 'Una devolución',
    turnos: 'Un turno de caja',
    config: 'La configuración',
    categorias: `La categoría${nombre}`,
    gruposModificadores: `El grupo${nombre}`,
    ingredientes: `El ingrediente${nombre}`,
    productos: `El producto${nombre}`,
    usuarios: `El usuario${nombre}`,
    dispositivos: `El dispositivo${nombre}`,
  };
  return tipos[error.tabla] ?? 'Un cambio';
}

/** Regresa la operación a la outbox (al final de la cola) y la vuelve a subir. */
export async function reintentarErrorSync(id: string, motor: MotorSync = motorSync): Promise<void> {
  await bd.transaction('rw', bd.erroresSync, bd.outbox, async () => {
    const error = await bd.erroresSync.get(id);
    if (!error) return;
    await bd.outbox.add({
      id: error.id,
      tabla: error.tabla,
      tipo: error.tipo,
      registroId: error.registroId,
      datos: error.datos,
      creadaEn: error.creadaEn,
      intentos: 0,
      ultimoError: null,
    });
    await bd.erroresSync.delete(id);
  });
  await motor.sincronizar({ forzar: true });
}
