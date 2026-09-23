import type { z } from 'zod';
import type * as e from './esquemas.js';

// Tipos del dominio (camelCase), derivados de los esquemas Zod para tener una sola fuente de verdad.

export type { Centavos } from './dinero.js';

export type Permiso = (typeof e.PERMISOS)[number];
export type Rol = (typeof e.ROLES)[number];
export type MetodoPago = (typeof e.METODOS_PAGO)[number];
export type TablaSync = (typeof e.TABLAS_SYNC)[number];
/** ISO 8601 con zona, p. ej. '2026-09-19T14:42:10.123Z'. */
export type Fecha = string;
export type RefUsuario = z.infer<typeof e.refUsuario>;

export type ConfigGeneral = z.infer<typeof e.esquemaConfigGeneral>;
export type Config = z.infer<typeof e.esquemaConfig>;
export type CuentaBancaria = z.infer<typeof e.esquemaCuentaBancaria>;
export type PermisosPorRol = ConfigGeneral['roles'];
/** Lo que el ticket de venta necesita de la configuración (también lo trae el ticket público). */
export type ConfigTicket = Pick<ConfigGeneral, 'negocio' | 'ticket' | 'ventas' | 'zonaHoraria'>;
export type Categoria = z.infer<typeof e.esquemaCategoria>;
export type OpcionModificador = z.infer<typeof e.esquemaOpcionModificador>;
export type GrupoModificadores = z.infer<typeof e.esquemaGrupoModificadores>;
export type Ingrediente = z.infer<typeof e.esquemaIngrediente>;
export type Armado = z.infer<typeof e.esquemaArmado>;
export type Tamano = z.infer<typeof e.esquemaTamano>;
export type Producto = z.infer<typeof e.esquemaProducto>;
export type Usuario = z.infer<typeof e.esquemaUsuario>;
export type Dispositivo = z.infer<typeof e.esquemaDispositivo>;
export type ResumenTurno = z.infer<typeof e.esquemaResumenTurno>;
export type Turno = z.infer<typeof e.esquemaTurno>;
export type Movimiento = z.infer<typeof e.esquemaMovimiento>;
export type LineaVenta = z.infer<typeof e.esquemaLineaVenta>;
export type DescuentoVenta = z.infer<typeof e.esquemaDescuento>;
export type Pago = z.infer<typeof e.esquemaPago>;
export type EstadoVenta = (typeof e.ESTADOS_VENTA)[number];
export type Cancelacion = z.infer<typeof e.esquemaCancelacion>;
export type Venta = z.infer<typeof e.esquemaVenta>;
export type Devolucion = z.infer<typeof e.esquemaDevolucion>;

/** Registro de cualquier tabla sincronizable. */
export interface RegistrosPorTabla {
  config: Config;
  categorias: Categoria;
  gruposModificadores: GrupoModificadores;
  ingredientes: Ingrediente;
  productos: Producto;
  usuarios: Usuario;
  dispositivos: Dispositivo;
  turnos: Turno;
  movimientos: Movimiento;
  ventas: Venta;
  devoluciones: Devolucion;
}

export type Operacion = z.infer<typeof e.esquemaOperacion>;
export type ResultadoOperacion = z.infer<typeof e.esquemaResultadoOperacion>;
export type RespuestaPush = z.infer<typeof e.esquemaRespuestaPush>;
export type FilaPull = z.infer<typeof e.esquemaFilaPull>;
export type RespuestaPull = z.infer<typeof e.esquemaRespuestaPull>;
export type RespuestaAcceso = z.infer<typeof e.esquemaRespuestaAcceso>;
