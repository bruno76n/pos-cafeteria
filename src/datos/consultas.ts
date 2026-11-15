import { useLiveQuery } from 'dexie-react-hooks';
import { consolidarLineas, ordenarPedidos } from '@/dominio/cuentas';
import type { RangoDias } from '@/dominio/fechas';
import type { Cuenta, LineaVenta, TablaSync } from '@/dominio/tipos';
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

export function useIngredientes() {
  return useLiveQuery(() => bd.ingredientes.orderBy('orden').toArray());
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

/** Cuentas abiertas de todos los dispositivos, de la más antigua a la más reciente. */
export function useCuentasAbiertas() {
  return useLiveQuery(async () =>
    (await bd.cuentasVenta.where('estado').equals('abierta').toArray()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    ),
  );
}

export interface CuentaConLineas {
  cuenta: Cuenta;
  /** Líneas vigentes de la cuenta (pedidos menos anulaciones). */
  lineas: LineaVenta[];
  comandas: number;
}

/** Cuentas abiertas con lo que llevan pedido (para las tarjetas, Inicio y el cierre de caja). */
export function useCuentasAbiertasConLineas() {
  return useLiveQuery(async (): Promise<CuentaConLineas[]> => {
    const abiertas = (await bd.cuentasVenta.where('estado').equals('abierta').toArray()).sort((a, b) =>
      a.fecha.localeCompare(b.fecha),
    );
    const pedidos = await bd.pedidos
      .where('cuentaId')
      .anyOf(abiertas.map((c) => c.id))
      .toArray();
    return abiertas.map((cuenta) => {
      const suyos = pedidos.filter((p) => p.cuentaId === cuenta.id);
      return { cuenta, lineas: consolidarLineas(suyos), comandas: suyos.length };
    });
  });
}

/**
 * `undefined` mientras carga. Al cambiar de cuenta no se queda con el resultado de la anterior:
 * `useLiveQuery` conserva el último valor hasta que llega el nuevo.
 */
export function useCuenta(id: string | null | undefined) {
  const r = useLiveQuery(
    async () => ({ id, cuenta: id ? ((await bd.cuentasVenta.get(id)) ?? null) : null }),
    [id],
  );
  return r && r.id === id ? r.cuenta : undefined;
}

/** Pedidos de una cuenta en el orden en que se enviaron (`undefined` mientras carga). */
export function usePedidosDeCuenta(cuentaId: string | null | undefined) {
  const r = useLiveQuery(
    async () => ({
      cuentaId,
      pedidos: cuentaId ? ordenarPedidos(await bd.pedidos.where('cuentaId').equals(cuentaId).toArray()) : [],
    }),
    [cuentaId],
  );
  return r && r.cuentaId === cuentaId ? r.pedidos : undefined;
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
