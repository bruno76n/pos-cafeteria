import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  Cancelacion,
  ConfigGeneral,
  DescuentoVenta,
  Devolucion,
  GrupoModificadores,
  LineaVenta,
  Pago,
  RefUsuario,
  ResumenTurno,
  Tamano,
  Venta,
} from '../../src/dominio/tipos';

// Mismas entidades que la tablet (docs/02-arquitectura.md §5). Columnas en snake_case
// (drizzle las traduce con casing: 'snake_case'); los campos del objeto van en camelCase.

/** Revisión compartida por todas las tablas: cursor del pull. */
export const revGlobal = pgSequence('rev_global');

const fechaHora = () => timestamp({ withTimezone: true, mode: 'date' });
const siguienteRev = sql`nextval('rev_global')`;

/** Columnas de sincronización de toda tabla sincronizable. */
const sync = () => ({
  actualizadoEn: fechaHora().notNull(),
  rev: bigint({ mode: 'number' }).notNull().default(siguienteRev),
});

export const cuentas = pgTable('cuentas', {
  id: text().primaryKey(),
  correo: text().notNull().unique(),
  hashContrasena: text().notNull(),
  activa: boolean().notNull().default(true),
  creadaEn: fechaHora().notNull().defaultNow(),
});

/** Operaciones ya aplicadas: reenviar la misma operación no tiene efecto doble. */
export const operacionesAplicadas = pgTable('operaciones_aplicadas', {
  id: text().primaryKey(),
  aplicadaEn: fechaHora().notNull().defaultNow(),
});

export const config = pgTable(
  'config',
  { id: text().primaryKey(), datos: jsonb().$type<ConfigGeneral>().notNull(), ...sync() },
  (t) => [index().on(t.rev)],
);

export const categorias = pgTable(
  'categorias',
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    color: text().notNull(),
    orden: integer().notNull(),
    activa: boolean().notNull(),
    borrado: boolean().notNull().default(false),
    ...sync(),
  },
  (t) => [index().on(t.rev)],
);

export const gruposModificadores = pgTable(
  'grupos_modificadores',
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    tipo: text().$type<GrupoModificadores['tipo']>().notNull(),
    obligatorio: boolean().notNull(),
    min: integer().notNull(),
    max: integer().notNull(),
    orden: integer().notNull(),
    opciones: jsonb().$type<GrupoModificadores['opciones']>().notNull(),
    borrado: boolean().notNull().default(false),
    ...sync(),
  },
  (t) => [index().on(t.rev)],
);

export const ingredientes = pgTable(
  'ingredientes',
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    grupo: text(),
    orden: integer().notNull(),
    disponible: boolean().notNull(),
    borrado: boolean().notNull().default(false),
    ...sync(),
  },
  (t) => [index().on(t.rev)],
);

export const productos = pgTable(
  'productos',
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    descripcion: text().notNull(),
    categoriaId: text().notNull(),
    precio: integer().notNull(),
    imagen: text(),
    disponible: boolean().notNull(),
    orden: integer().notNull(),
    gruposIds: jsonb().$type<string[]>().notNull(),
    tamanos: jsonb().$type<Tamano[]>().notNull().default([]),
    borrado: boolean().notNull().default(false),
    ...sync(),
  },
  (t) => [index().on(t.rev)],
);

export const usuarios = pgTable(
  'usuarios',
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    rol: text().$type<'admin' | 'encargado' | 'cajero'>().notNull(),
    pinHash: text().notNull(),
    pinSal: text().notNull(),
    activo: boolean().notNull(),
    ...sync(),
  },
  (t) => [index().on(t.rev)],
);

export const dispositivos = pgTable(
  'dispositivos',
  {
    id: text().primaryKey(),
    nombre: text().notNull(),
    tipo: text().$type<'caja' | 'consulta'>().notNull(),
    prefijo: text(),
    ultimoFolio: integer().notNull(),
    ...sync(),
  },
  (t) => [index().on(t.rev)],
);

export const turnos = pgTable(
  'turnos',
  {
    id: text().primaryKey(),
    dispositivoId: text().notNull(),
    dispositivoNombre: text().notNull(),
    estado: text().$type<'abierto' | 'cerrado'>().notNull(),
    abiertoPor: jsonb().$type<RefUsuario>().notNull(),
    abiertoEn: fechaHora().notNull(),
    dia: date({ mode: 'string' }).notNull(),
    fondoInicial: integer().notNull(),
    cerradoPor: jsonb().$type<RefUsuario>(),
    cerradoEn: fechaHora(),
    efectivoContado: integer(),
    conteo: jsonb().$type<Record<string, number>>(),
    resumen: jsonb().$type<ResumenTurno>(),
    nota: text(),
    ...sync(),
  },
  (t) => [index().on(t.dispositivoId, t.estado), index().on(t.dia), index().on(t.rev)],
);

export const movimientos = pgTable(
  'movimientos',
  {
    id: text().primaryKey(),
    turnoId: text().notNull(),
    dispositivoId: text().notNull(),
    tipo: text().$type<'entrada' | 'retiro' | 'gasto'>().notNull(),
    categoria: text(),
    concepto: text().notNull(),
    monto: integer().notNull(),
    usuario: jsonb().$type<RefUsuario>().notNull(),
    fecha: fechaHora().notNull(),
    dia: date({ mode: 'string' }).notNull(),
    anulado: boolean().notNull(),
    anuladoPor: jsonb().$type<RefUsuario>(),
    anuladoEn: fechaHora(),
    ...sync(),
  },
  (t) => [index().on(t.turnoId), index().on(t.dia), index().on(t.rev)],
);

export const ventas = pgTable(
  'ventas',
  {
    id: text().primaryKey(),
    folio: text().notNull(),
    folioNumero: integer().notNull(),
    dispositivoId: text().notNull(),
    dispositivoNombre: text().notNull(),
    turnoId: text().notNull(),
    fecha: fechaHora().notNull(),
    dia: date({ mode: 'string' }).notNull(),
    cajero: jsonb().$type<RefUsuario>().notNull(),
    cliente: text(),
    lineas: jsonb().$type<LineaVenta[]>().notNull(),
    subtotal: integer().notNull(),
    descuento: jsonb().$type<DescuentoVenta>(),
    iva: jsonb().$type<Venta['iva']>().notNull(),
    total: integer().notNull(),
    pagos: jsonb().$type<Pago[]>().notNull(),
    cambio: integer().notNull(),
    estado: text().$type<Venta['estado']>().notNull(),
    devuelto: integer().notNull(),
    cancelacion: jsonb().$type<Cancelacion>(),
    ...sync(),
  },
  (t) => [
    uniqueIndex().on(t.folio),
    index().on(t.fecha),
    index().on(t.dia),
    index().on(t.turnoId),
    index().on(t.rev),
  ],
);

export const devoluciones = pgTable(
  'devoluciones',
  {
    id: text().primaryKey(),
    ventaId: text().notNull(),
    folioVenta: text().notNull(),
    turnoId: text(),
    dispositivoId: text().notNull(),
    lineas: jsonb().$type<Devolucion['lineas']>().notNull(),
    monto: integer().notNull(),
    metodo: text().$type<Devolucion['metodo']>().notNull(),
    motivo: text().notNull(),
    usuario: jsonb().$type<RefUsuario>().notNull(),
    autorizadoPor: jsonb().$type<RefUsuario>(),
    fecha: fechaHora().notNull(),
    dia: date({ mode: 'string' }).notNull(),
    ...sync(),
  },
  (t) => [index().on(t.fecha), index().on(t.dia), index().on(t.ventaId), index().on(t.rev)],
);

/** Tabla de Postgres de cada tabla sincronizable. */
export const TABLAS = {
  config,
  categorias,
  gruposModificadores,
  ingredientes,
  productos,
  usuarios,
  dispositivos,
  turnos,
  movimientos,
  ventas,
  devoluciones,
} as const;
