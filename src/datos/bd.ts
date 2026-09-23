import Dexie, { type Table } from 'dexie';
import type { Carrito } from '@/dominio/carrito';
import type {
  Dispositivo,
  Operacion,
  Producto,
  RegistrosPorTabla,
  RespuestaAcceso,
  TablaSync,
} from '@/dominio/tipos';

// Base local (IndexedDB): fuente de verdad de la tablet. Mismas tablas que el servidor
// más la cola de salida (outbox), metadatos y errores de sincronización.

export interface OperacionOutbox extends Operacion {
  /** Orden de creación (autoincremental): el push respeta este orden. */
  orden?: number;
  intentos: number;
  ultimoError: string | null;
}

export interface ErrorSync {
  /** Id de la operación rechazada. */
  id: string;
  tabla: TablaSync;
  tipo: Operacion['tipo'];
  registroId: string;
  datos: Record<string, unknown>;
  creadaEn: string;
  motivo: string;
  fecha: string;
}

export interface ConfigImpresora {
  tipo: 'navegador' | 'usb' | 'bluetooth';
  /** Datos que devuelve el driver para reconectar sin volver a elegir el dispositivo. */
  reconexion: unknown;
}

/** Última venta cobrada: se muestra en el carrito vacío hasta agregar el siguiente producto. */
export interface UltimaVenta {
  ventaId: string;
  folio: string;
  cambio: number;
  total: number;
}

/** Metadatos locales (no se sincronizan). */
export interface Meta {
  sesion: { token: string; cuenta: RespuestaAcceso['cuenta']; expirada: boolean };
  dispositivoId: string;
  cursorPull: number;
  ultimaLimpieza: string;
  carrito: Carrito;
  ultimaVenta: UltimaVenta | null;
  impresora: ConfigImpresora;
  bloqueoMinutos: number;
  almacenamientoPersistente: boolean;
  /** El primer pull terminó (para saber si "no hay configuración" es definitivo). */
  primerPullCompleto: boolean;
  tema: 'automatico' | 'claro' | 'oscuro';
}

export type ClaveMeta = keyof Meta;

type TablasSync = { [K in TablaSync]: Table<RegistrosPorTabla[K], string> };

export class BaseLocal extends Dexie {
  declare config: TablasSync['config'];
  declare categorias: TablasSync['categorias'];
  declare gruposModificadores: TablasSync['gruposModificadores'];
  declare ingredientes: TablasSync['ingredientes'];
  declare productos: TablasSync['productos'];
  declare usuarios: TablasSync['usuarios'];
  declare dispositivos: TablasSync['dispositivos'];
  declare turnos: TablasSync['turnos'];
  declare movimientos: TablasSync['movimientos'];
  declare ventas: TablasSync['ventas'];
  declare devoluciones: TablasSync['devoluciones'];
  declare outbox: Table<OperacionOutbox, number>;
  declare meta: Table<{ clave: ClaveMeta; valor: unknown }, ClaveMeta>;
  declare erroresSync: Table<ErrorSync, string>;

  constructor(nombre = 'pos-cafeteria') {
    super(nombre);
    this.version(1).stores({
      config: 'id',
      categorias: 'id, orden',
      gruposModificadores: 'id, orden',
      productos: 'id, categoriaId, orden',
      usuarios: 'id',
      dispositivos: 'id',
      turnos: 'id, dispositivoId, estado, dia, [dispositivoId+estado]',
      movimientos: 'id, turnoId, dia',
      ventas: 'id, turnoId, dia, folio, dispositivoId',
      devoluciones: 'id, ventaId, turnoId, dia',
      outbox: '++orden, &id, tabla, registroId',
      meta: 'clave',
      erroresSync: 'id, registroId',
    });
    // Tamaños por producto y catálogo de ingredientes: los productos guardados antes no traen
    // los campos nuevos.
    this.version(2)
      .stores({ ingredientes: 'id, orden' })
      .upgrade((tx) =>
        tx
          .table('productos')
          .toCollection()
          .modify((p: Partial<Producto>) => {
            p.tamanos ??= [];
            p.armado ??= null;
          }),
      );
    // Dispositivos que se pueden desactivar.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('dispositivos')
          .toCollection()
          .modify((d: Partial<Dispositivo>) => {
            d.activo ??= true;
          }),
      );
  }

  tabla<T extends TablaSync>(nombre: T): TablasSync[T] {
    return this.table(nombre) as unknown as TablasSync[T];
  }
}

export const bd = new BaseLocal();

export async function leerMeta<K extends ClaveMeta>(clave: K): Promise<Meta[K] | undefined> {
  return (await bd.meta.get(clave))?.valor as Meta[K] | undefined;
}

export async function guardarMeta<K extends ClaveMeta>(clave: K, valor: Meta[K]): Promise<void> {
  await bd.meta.put({ clave, valor });
}
