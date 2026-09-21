import {
  BookOpen,
  ChartColumn,
  House,
  ReceiptText,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Permiso } from '@/dominio/tipos';

export type IdSeccion =
  'inicio' | 'venta' | 'ventas' | 'menu' | 'caja' | 'reportes' | 'usuarios' | 'configuracion';

export interface ContextoSeccion {
  puede: (permiso: Permiso) => boolean;
  esAdmin: boolean;
  /** Dispositivo de tipo caja (los de consulta no venden). */
  esCaja: boolean;
}

export interface Seccion {
  id: IdSeccion;
  ruta: string;
  nombre: string;
  icono: LucideIcon;
  /** Texto para "Tu usuario no puede …" */
  accion: string;
  visible: (c: ContextoSeccion) => boolean;
}

export const SECCIONES: Seccion[] = [
  {
    id: 'inicio',
    ruta: '/inicio',
    nombre: 'Inicio',
    icono: House,
    accion: 'ver el inicio',
    visible: () => true,
  },
  {
    id: 'venta',
    ruta: '/venta',
    nombre: 'Venta',
    icono: ShoppingBag,
    accion: 'vender',
    visible: (c) => c.esCaja && c.puede('vender'),
  },
  {
    id: 'ventas',
    ruta: '/ventas',
    nombre: 'Ventas',
    icono: ReceiptText,
    accion: 'ver las ventas',
    visible: (c) => c.puede('vender') || c.puede('cancelarVentas') || c.puede('verReportes'),
  },
  {
    id: 'menu',
    ruta: '/menu/productos',
    nombre: 'Menú',
    icono: BookOpen,
    accion: 'editar el menú',
    visible: (c) => c.puede('crearProductos') || c.puede('modificarPrecios'),
  },
  {
    id: 'caja',
    ruta: '/caja',
    nombre: 'Caja',
    icono: Wallet,
    accion: 'usar la caja',
    visible: (c) =>
      ['abrirCaja', 'cerrarCaja', 'registrarGastos', 'verReportes'].some((p) => c.puede(p as Permiso)),
  },
  {
    id: 'reportes',
    ruta: '/reportes',
    nombre: 'Reportes',
    icono: ChartColumn,
    accion: 'ver reportes',
    visible: (c) => c.puede('verReportes'),
  },
  {
    id: 'usuarios',
    ruta: '/usuarios',
    nombre: 'Usuarios',
    icono: Users,
    accion: 'administrar usuarios',
    visible: (c) => c.esAdmin,
  },
  {
    id: 'configuracion',
    ruta: '/configuracion/negocio',
    nombre: 'Configuración',
    icono: Settings,
    accion: 'cambiar la configuración',
    visible: (c) => c.esAdmin,
  },
];

export const seccion = (id: IdSeccion) => SECCIONES.find((s) => s.id === id)!;

/** En vertical y celular: cinco accesos abajo; el resto va en "Más". */
export const SECCIONES_BARRA_INFERIOR: IdSeccion[] = ['inicio', 'venta', 'ventas', 'caja'];
