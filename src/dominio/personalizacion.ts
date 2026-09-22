import { formatearDinero, type Centavos } from './dinero';
import {
  gruposDelProducto,
  resumenModificadores,
  validarSeleccion,
  type ModificadorElegido,
  type Seleccion,
} from './modificadores';
import type { GrupoModificadores, LineaVenta, Producto, Tamano } from './tipos';

// Personalización de un producto en la venta: tamaño y modificadores. Funciones puras.

/** Lo que se eligió en la hoja de personalización. */
export interface Eleccion {
  tamanoId: string | null;
  /** Modificadores: grupoId → ids de opción. */
  seleccion: Seleccion;
}

/** ¿Tocar el producto abre la hoja de personalización? */
export function sePersonaliza(producto: Producto, grupos: GrupoModificadores[]): boolean {
  return producto.tamanos.length > 0 || gruposDelProducto(producto, grupos).length > 0;
}

/** El primer tamaño es el que viene elegido. */
export function tamanoInicial(producto: Producto): string | null {
  return producto.tamanos[0]?.id ?? null;
}

export function tamanoDe(producto: Producto, tamanoId: string | null): Tamano | undefined {
  return producto.tamanos.find((t) => t.id === tamanoId);
}

/** Precio del tamaño elegido, o el precio base si el producto no tiene tamaños. */
export function precioBaseDe(producto: Producto, tamanoId: string | null): Centavos {
  return tamanoDe(producto, tamanoId)?.precio ?? producto.precio;
}

/** Lo menos que cuesta el producto: el tamaño más barato, o el precio base. */
export function precioDesde(producto: Producto): Centavos {
  return producto.tamanos.length > 0 ? Math.min(...producto.tamanos.map((t) => t.precio)) : producto.precio;
}

/** "$45.00", o "Desde $55.00" si tiene tamaños. */
export function textoPrecio(producto: Producto): string {
  const precio = formatearDinero(precioDesde(producto));
  return producto.tamanos.length > 0 ? `Desde ${precio}` : precio;
}

/** precioUnitario = precio del tamaño (o base) + Σ precio extra de los modificadores */
export function precioUnitario(precioBase: Centavos, modificadores: ModificadorElegido[]): Centavos {
  return modificadores.reduce((suma, m) => suma + m.precioExtra, precioBase);
}

/** Qué falta para poder agregar (vacío si está completo). El primer mensaje va en el botón. */
export function validarEleccion(
  producto: Producto,
  grupos: GrupoModificadores[],
  eleccion: Eleccion,
): string[] {
  const errores: string[] = [];
  if (producto.tamanos.length > 0 && !tamanoDe(producto, eleccion.tamanoId)) errores.push('Elige el tamaño');
  errores.push(
    ...validarSeleccion(gruposDelProducto(producto, grupos), eleccion.seleccion).map((e) => e.mensaje),
  );
  return errores;
}

type LineaMostrable = Pick<LineaVenta, 'nombre' | 'tamano' | 'modificadores'>;

/** "Latte Mediano 16 oz" */
export function nombreLinea(linea: LineaMostrable): string {
  return linea.tamano ? `${linea.nombre} ${linea.tamano.nombre}` : linea.nombre;
}

/** "Almendra, 1 shot extra" */
export function detalleLinea(linea: LineaMostrable): string {
  return resumenModificadores(linea.modificadores);
}
