import { ahoraISO } from '@/dominio/fechas';
import { contadorInicial, siguienteFolio } from '@/dominio/folios';
import { TABLAS_ULTIMO_GANA } from '@/dominio/reglasServidor';
import type { Operacion, RegistrosPorTabla, TablaSync, Venta } from '@/dominio/tipos';
import { bd, guardarMeta, leerMeta, type OperacionOutbox } from './bd';

// Toda escritura pasa por aquí: guarda el registro y agrega su operación a la outbox
// en UNA sola transacción de Dexie. Nada de fetch: la red la toca solo el motor de sync.

const oyentes = new Set<() => void>();

/** El motor de sync se suscribe para subir 1 s después de cada escritura. */
export function alEscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function avisar() {
  for (const o of oyentes) o();
}

function operacion(
  tabla: TablaSync,
  tipo: Operacion['tipo'],
  registroId: string,
  datos: object,
): OperacionOutbox {
  return {
    id: crypto.randomUUID(),
    tabla,
    tipo,
    registroId,
    datos: datos as Record<string, unknown>,
    creadaEn: ahoraISO(),
    intentos: 0,
    ultimoError: null,
  };
}

type SinFecha<T> = Omit<T, 'actualizadoEn'>;

/** Crea un registro nuevo (ventas, movimientos, devoluciones, turnos o catálogo). */
export async function crear<T extends TablaSync>(tabla: T, registro: SinFecha<RegistrosPorTabla[T]>) {
  const completo = { ...registro, actualizadoEn: ahoraISO() } as RegistrosPorTabla[T];
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    await bd.tabla(tabla).add(completo as never);
    await bd.outbox.add(operacion(tabla, 'crear', completo.id, completo));
  });
  avisar();
  return completo;
}

/**
 * Guarda un registro completo de catálogo o configuración (gana el último en el servidor).
 * Crea si no existe; si existe, lo reemplaza.
 */
export async function guardar<T extends TablaSync>(tabla: T, registro: SinFecha<RegistrosPorTabla[T]>) {
  if (!TABLAS_ULTIMO_GANA.includes(tabla))
    throw new Error(`${tabla} no se guarda completo; usa crear/actualizar`);
  const completo = { ...registro, actualizadoEn: ahoraISO() } as RegistrosPorTabla[T];
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    const existe = await bd.tabla(tabla).get(completo.id);
    await bd.tabla(tabla).put(completo as never);
    await bd.outbox.add(operacion(tabla, existe ? 'actualizar' : 'crear', completo.id, completo));
  });
  avisar();
  return completo;
}

/** Cambia campos de un registro (ventas: estado, cancelación, devuelto; movimientos: anulación; turnos). */
export async function actualizar<T extends 'ventas' | 'movimientos' | 'turnos'>(
  tabla: T,
  id: string,
  cambios: Partial<SinFecha<RegistrosPorTabla[T]>>,
) {
  const conFecha = { ...cambios, actualizadoEn: ahoraISO() };
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    const n = await bd.tabla(tabla).update(id, conFecha as never);
    if (n === 0) throw new Error(`No existe ${tabla}/${id}`);
    await bd.outbox.add(operacion(tabla, 'actualizar', id, conFecha));
  });
  avisar();
}

/** Borra categorías, grupos o productos (las ventas guardan copia). */
export async function borrar(tabla: 'categorias' | 'gruposModificadores' | 'productos', id: string) {
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    await bd.tabla(tabla).delete(id);
    await bd.outbox.add(operacion(tabla, 'borrar', id, { actualizadoEn: ahoraISO() }));
  });
  avisar();
}

export type VentaSinFolio = SinFecha<Omit<Venta, 'folio' | 'folioNumero'>>;

/**
 * Registra una venta: asigna el folio del dispositivo, guarda la venta, sube el contador y
 * encola ambas operaciones, todo en la misma transacción.
 */
export async function registrarVenta(venta: VentaSinFolio): Promise<Venta> {
  let guardada: Venta | undefined;
  await bd.transaction('rw', bd.ventas, bd.dispositivos, bd.outbox, async () => {
    const dispositivo = await bd.dispositivos.get(venta.dispositivoId);
    if (!dispositivo) throw new Error('Este dispositivo no está configurado.');
    const { folio, numero } = siguienteFolio(dispositivo);
    const ahora = ahoraISO();
    guardada = { ...venta, folio, folioNumero: numero, actualizadoEn: ahora };
    const conContador = { ...dispositivo, ultimoFolio: numero, actualizadoEn: ahora };
    await bd.ventas.add(guardada);
    await bd.dispositivos.put(conContador);
    await bd.outbox.add(operacion('ventas', 'crear', guardada.id, guardada));
    await bd.outbox.add(operacion('dispositivos', 'actualizar', conContador.id, conContador));
  });
  avisar();
  return guardada!;
}

/**
 * Configura (o reconfigura) este dispositivo. El contador de folios arranca en el mayor entre
 * el de los dispositivos que usaban ese prefijo y el folio más alto de las ventas locales con él.
 */
export async function configurarDispositivo(datos: {
  nombre: string;
  tipo: 'caja' | 'consulta';
  prefijo: string | null;
}) {
  const id = (await leerMeta('dispositivoId')) ?? crypto.randomUUID();
  const actual = await bd.dispositivos.get(id);
  let ultimoFolio = actual?.ultimoFolio ?? 0;
  if (datos.prefijo && datos.prefijo !== actual?.prefijo) {
    const conPrefijo = await bd.dispositivos.filter((d) => d.prefijo === datos.prefijo).toArray();
    const folios = (await bd.ventas.where('folio').startsWith(`${datos.prefijo}-`).toArray()).map(
      (v) => v.folio,
    );
    ultimoFolio = contadorInicial(
      datos.prefijo,
      Math.max(0, ...conPrefijo.map((d) => d.ultimoFolio)),
      folios,
    );
  }
  const registro = await guardar('dispositivos', { id, ...datos, nombre: datos.nombre.trim(), ultimoFolio });
  await guardarMeta('dispositivoId', id);
  return registro;
}
