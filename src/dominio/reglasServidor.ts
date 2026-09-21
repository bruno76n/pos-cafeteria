import { z } from 'zod';
import {
  centavosPositivos,
  dia,
  ESQUEMAS_TABLA,
  esquemaCancelacion,
  esquemaTurno,
  ESTADOS_VENTA,
  fecha,
  id,
  refUsuario,
} from './esquemas';
import type { Operacion, TablaSync } from './tipos';

// Qué operación se permite en qué tabla (docs/02-arquitectura.md §6). Funciones puras: las usa
// servidor/rutas/sync.ts para decidir la sentencia SQL de cada operación.

/** Catálogo y configuración: upsert donde gana el actualizadoEn más reciente. */
export const TABLAS_ULTIMO_GANA: readonly TablaSync[] = [
  'config',
  'categorias',
  'gruposModificadores',
  'productos',
  'usuarios',
  'dispositivos',
];

/** Se pueden borrar porque las ventas guardan copia. */
export const TABLAS_BORRABLES: readonly TablaSync[] = ['categorias', 'gruposModificadores', 'productos'];

/** Tablas que el pull limita a los últimos 35 días. */
export const TABLAS_CON_ALCANCE: readonly TablaSync[] = ['ventas', 'movimientos', 'devoluciones', 'turnos'];

/** Campos que se pueden cambiar con `actualizar` (además de actualizadoEn). */
export const CAMPOS_ACTUALIZABLES: Partial<Record<TablaSync, readonly string[]>> = {
  ventas: ['estado', 'cancelacion', 'devuelto'],
  movimientos: ['anulado', 'anuladoPor', 'anuladoEn'],
};

/**
 * Validación poco estricta a propósito para crear ventas: rechazar una venta al sincronizar
 * es peor que aceptar un dato raro. Solo se exige lo que necesitan las columnas y los reportes.
 */
const ventaTolerante = z.looseObject({
  id,
  folio: z.string().min(1),
  folioNumero: z.number().int(),
  dispositivoId: id,
  dispositivoNombre: z.string().catch(''),
  turnoId: id,
  fecha,
  dia,
  cajero: z.looseObject({ id: z.string(), nombre: z.string() }),
  cliente: z.string().nullable().catch(null),
  lineas: z.array(z.looseObject({ importe: z.number(), cantidad: z.number() })),
  subtotal: z.number().int(),
  descuento: z.looseObject({ importe: z.number() }).nullable().catch(null),
  iva: z.looseObject({}),
  total: z.number().int(),
  pagos: z.array(z.looseObject({ metodo: z.string(), monto: z.number() })),
  cambio: z.number().int().catch(0),
  estado: z.enum(ESTADOS_VENTA).catch('pagada'),
  devuelto: z.number().int().catch(0),
  cancelacion: z.looseObject({}).nullable().catch(null),
  actualizadoEn: fecha,
});

const cambiosVenta = z.strictObject({
  estado: z.enum(ESTADOS_VENTA).optional(),
  cancelacion: esquemaCancelacion.nullable().optional(),
  devuelto: centavosPositivos.optional(),
  actualizadoEn: fecha,
});

const cambiosMovimiento = z.strictObject({
  anulado: z.boolean().optional(),
  anuladoPor: refUsuario.optional(),
  anuladoEn: fecha.optional(),
  actualizadoEn: fecha,
});

const cambiosTurno = esquemaTurno
  .omit({ id: true, dispositivoId: true })
  .partial()
  .required({ actualizadoEn: true })
  .strict();

export type Accion =
  /** INSERT … ON CONFLICT (id) DO NOTHING. Sin fila nueva = duplicada. */
  | { tipo: 'insertar'; valores: Record<string, unknown> }
  /** Upsert donde gana el actualizadoEn más reciente. Sin cambio = duplicada. */
  | { tipo: 'upsert'; valores: Record<string, unknown> }
  /** UPDATE de campos permitidos. `soloTurnoAbierto`: solo si el turno sigue abierto. */
  | { tipo: 'actualizar'; valores: Record<string, unknown>; soloTurnoAbierto: boolean }
  /** Marca el registro como borrado (lápida para que el pull lo propague). */
  | { tipo: 'borrar'; actualizadoEn: string };

export type Evaluacion = { ok: true; accion: Accion } | { ok: false; motivo: string };

const rechazo = (motivo: string): Evaluacion => ({ ok: false, motivo });

function errorZod(error: z.ZodError): string {
  const p = error.issues[0];
  return p ? `Dato inválido en ${p.path.join('.') || 'el registro'}: ${p.message}` : 'Datos inválidos';
}

/** Decide qué hacer con una operación de la outbox, o por qué se rechaza. */
export function evaluarOperacion(op: Pick<Operacion, 'tabla' | 'tipo' | 'registroId' | 'datos'>): Evaluacion {
  const { tabla, tipo, datos } = op;
  if ('id' in datos && datos.id !== op.registroId) return rechazo('El id del registro no coincide.');

  if (tipo === 'borrar') {
    if (!TABLAS_BORRABLES.includes(tabla)) return rechazo(`No se puede borrar en ${tabla}.`);
    const r = z.object({ actualizadoEn: fecha }).safeParse(datos);
    return r.success
      ? { ok: true, accion: { tipo: 'borrar', actualizadoEn: r.data.actualizadoEn } }
      : rechazo(errorZod(r.error));
  }

  if (TABLAS_ULTIMO_GANA.includes(tabla)) {
    const r = ESQUEMAS_TABLA[tabla].safeParse({ ...datos, id: op.registroId });
    return r.success ? { ok: true, accion: { tipo: 'upsert', valores: r.data } } : rechazo(errorZod(r.error));
  }

  if (tipo === 'crear') {
    const esquema = tabla === 'ventas' ? ventaTolerante : ESQUEMAS_TABLA[tabla];
    const r = esquema.safeParse({ ...datos, id: op.registroId });
    return r.success
      ? { ok: true, accion: { tipo: 'insertar', valores: r.data } }
      : rechazo(errorZod(r.error));
  }

  // actualizar en ventas, movimientos, devoluciones y turnos: se crean una vez y nunca se borran
  const esquemaCambios =
    tabla === 'ventas'
      ? cambiosVenta
      : tabla === 'movimientos'
        ? cambiosMovimiento
        : tabla === 'turnos'
          ? cambiosTurno
          : null;
  if (!esquemaCambios) return rechazo(`No se puede modificar un registro de ${tabla}.`);
  const { id: _id, ...cambios } = datos;
  const permitidos = CAMPOS_ACTUALIZABLES[tabla];
  if (permitidos) {
    const prohibido = Object.keys(cambios).find((k) => k !== 'actualizadoEn' && !permitidos.includes(k));
    if (prohibido) return rechazo(`No se puede cambiar el campo ${prohibido} en ${tabla}.`);
  }
  const r = esquemaCambios.safeParse(cambios);
  if (!r.success) return rechazo(errorZod(r.error));
  return { ok: true, accion: { tipo: 'actualizar', valores: r.data, soloTurnoAbierto: tabla === 'turnos' } };
}
