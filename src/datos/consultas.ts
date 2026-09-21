import { useLiveQuery } from 'dexie-react-hooks';
import type { RangoDias } from '@/dominio/fechas';
import type { TablaSync } from '@/dominio/tipos';
import { bd, type ClaveMeta, type Meta } from './bd';

// Lecturas de pantalla: siempre de Dexie con useLiveQuery (nunca esperan a la red).
// `undefined` significa "cargando".

export function useMeta<K extends ClaveMeta>(clave: K): Meta[K] | null | undefined {
  return useLiveQuery(
    async () => ((await bd.meta.get(clave))?.valor as Meta[K] | undefined) ?? null,
    [clave],
  );
}

export function useConfig() {
  return useLiveQuery(async () => (await bd.config.get('general'))?.datos ?? null);
}

export function useCategorias() {
  return useLiveQuery(() => bd.categorias.orderBy('orden').toArray());
}

export function useProductos() {
  return useLiveQuery(() => bd.productos.orderBy('orden').toArray());
}

export function useGruposModificadores() {
  return useLiveQuery(() => bd.gruposModificadores.orderBy('orden').toArray());
}

export function useUsuarios() {
  return useLiveQuery(() => bd.usuarios.toArray());
}

export function useDispositivos() {
  return useLiveQuery(() => bd.dispositivos.toArray());
}

export function useDispositivo(id: string | null | undefined) {
  return useLiveQuery(async () => (id ? ((await bd.dispositivos.get(id)) ?? null) : null), [id]);
}

/** Turno abierto del dispositivo (null si la caja está cerrada). */
export function useTurnoAbierto(dispositivoId: string | null | undefined) {
  return useLiveQuery(
    async () =>
      dispositivoId
        ? ((await bd.turnos.where('[dispositivoId+estado]').equals([dispositivoId, 'abierto']).first()) ??
          null)
        : null,
    [dispositivoId],
  );
}

export function useTurno(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await bd.turnos.get(id)) ?? null) : null), [id]);
}

export function useVenta(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await bd.ventas.get(id)) ?? null) : null), [id]);
}

/** Ventas, movimientos y devoluciones de un rango de días (datos locales). */
export function useDatosDelRango(rango: RangoDias) {
  return useLiveQuery(async () => {
    const { desde, hasta } = rango;
    const [ventas, movimientos, devoluciones, turnos] = await Promise.all([
      bd.ventas.where('dia').between(desde, hasta, true, true).toArray(),
      bd.movimientos.where('dia').between(desde, hasta, true, true).toArray(),
      bd.devoluciones.where('dia').between(desde, hasta, true, true).toArray(),
      bd.turnos.where('dia').between(desde, hasta, true, true).toArray(),
    ]);
    return { ventas, movimientos, devoluciones, turnos };
  }, [rango.desde, rango.hasta]);
}

/** Datos de un turno: sus ventas, movimientos y las devoluciones hechas en él. */
export function useDatosDelTurno(turnoId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!turnoId) return null;
    const [ventas, movimientos, devoluciones] = await Promise.all([
      bd.ventas.where('turnoId').equals(turnoId).toArray(),
      bd.movimientos.where('turnoId').equals(turnoId).toArray(),
      bd.devoluciones.where('turnoId').equals(turnoId).toArray(),
    ]);
    return { ventas, movimientos, devoluciones };
  }, [turnoId]);
}

/** Ids de registros con operaciones pendientes de subir, de una tabla. */
export function usePendientes(tabla: TablaSync) {
  return useLiveQuery(
    async () => new Set((await bd.outbox.where('tabla').equals(tabla).toArray()).map((o) => o.registroId)),
    [tabla],
  );
}

export function useErroresSync() {
  return useLiveQuery(async () =>
    (await bd.erroresSync.toArray()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  );
}

/** Turnos cerrados (cortes), del más reciente al más antiguo. */
export function useCortes() {
  return useLiveQuery(async () =>
    (await bd.turnos.where('estado').equals('cerrado').toArray()).sort((a, b) =>
      (b.cerradoEn ?? '').localeCompare(a.cerradoEn ?? ''),
    ),
  );
}

export function useDevolucionesDeVenta(ventaId: string | undefined) {
  return useLiveQuery(
    async () =>
      ventaId
        ? (await bd.devoluciones.where('ventaId').equals(ventaId).toArray()).sort((a, b) =>
            a.fecha.localeCompare(b.fecha),
          )
        : [],
    [ventaId],
  );
}

/** Una venta reciente de la tablet (para la vista previa del ticket en Configuración). */
export function useVentaReciente() {
  return useLiveQuery(async () => (await bd.ventas.orderBy('dia').reverse().first()) ?? null);
}
