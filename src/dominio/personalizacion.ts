import { formatearDinero, type Centavos } from './dinero.js';
import {
  gruposDelProducto,
  resumenModificadores,
  validarSeleccion,
  type ModificadorElegido,
  type Seleccion,
} from './modificadores.js';
import type { GrupoModificadores, Ingrediente, LineaVenta, Producto, Tamano } from './tipos.js';

// Personalización de un producto en la venta: tamaño, ingredientes y modificadores. Funciones puras.

/** Lo que se eligió en la hoja de personalización. */
export interface Eleccion {
  tamanoId: string | null;
  /** Ingredientes elegidos (solo en productos que se arman con ingredientes). */
  ingredientesIds: string[];
  /** Modificadores: grupoId → ids de opción. */
  seleccion: Seleccion;
}

export type IngredientesElegidos = NonNullable<LineaVenta['ingredientes']>;

/** ¿Tocar el producto abre la hoja de personalización? */
export function sePersonaliza(producto: Producto, grupos: GrupoModificadores[]): boolean {
  return (
    producto.tamanos.length > 0 || producto.armado !== null || gruposDelProducto(producto, grupos).length > 0
  );
}

// Tamaños

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

// Ingredientes

/** Ingredientes que se pueden elegir en el producto, en orden del catálogo (con los no disponibles). */
export function ingredientesDelProducto(producto: Producto, ingredientes: Ingrediente[]): Ingrediente[] {
  const armado = producto.armado;
  if (!armado) return [];
  return ingredientes
    .filter((i) => !armado.permitidos || armado.permitidos.includes(i.id))
    .sort((a, b) => a.orden - b.orden);
}

/** Ingredientes incluidos en el precio: los del tamaño elegido, o los del producto sin tamaños. */
export function incluidosDe(producto: Producto, tamanoId: string | null): number {
  if (!producto.armado) return 0;
  return tamanoDe(producto, tamanoId)?.incluidos ?? producto.armado.incluidos;
}

/** Los que pasan de los incluidos se cobran como extra (elegir menos no descuenta). */
export function extrasDeIngredientes(elegidos: number, incluidos: number): number {
  return Math.max(0, elegidos - incluidos);
}

/** ¿Se puede elegir otro ingrediente? (al llegar al máximo se apagan los demás) */
export function puedeAgregarIngrediente(producto: Producto, elegidos: string[]): boolean {
  const max = producto.armado?.max ?? null;
  return max === null || elegidos.length < max;
}

/** Toca un ingrediente: si estaba, lo quita; si no, lo agrega si está disponible y no se llegó al máximo. */
export function alternarIngrediente(
  producto: Producto,
  ingredientes: Ingrediente[],
  elegidos: string[],
  id: string,
): string[] {
  if (elegidos.includes(id)) return elegidos.filter((x) => x !== id);
  const ingrediente = ingredientesDelProducto(producto, ingredientes).find((i) => i.id === id);
  if (!ingrediente?.disponible || !puedeAgregarIngrediente(producto, elegidos)) return elegidos;
  return [...elegidos, id];
}

/** Copia de los ingredientes elegidos (en orden del catálogo) y de cómo se cobran. */
export function ingredientesElegidos(
  producto: Producto,
  ingredientes: Ingrediente[],
  eleccion: Pick<Eleccion, 'tamanoId' | 'ingredientesIds'>,
): IngredientesElegidos | undefined {
  if (!producto.armado) return undefined;
  const nombres = ingredientesDelProducto(producto, ingredientes)
    .filter((i) => eleccion.ingredientesIds.includes(i.id))
    .map((i) => i.nombre);
  const incluidos = incluidosDe(producto, eleccion.tamanoId);
  return {
    nombres,
    incluidos,
    extras: extrasDeIngredientes(nombres.length, incluidos),
    precioExtra: producto.armado.precioExtra,
  };
}

/** "Incluye 2. Cada extra +$5.00" (y el máximo, si hay). */
export function indicacionIngredientes(producto: Producto, tamanoId: string | null): string {
  const armado = producto.armado;
  if (!armado) return '';
  const incluidos = incluidosDe(producto, tamanoId);
  const extra = `+${formatearDinero(armado.precioExtra)}`;
  const partes: string[] = [];
  if (incluidos > 0) partes.push(`Incluye ${incluidos}`);
  if (armado.precioExtra > 0)
    partes.push(incluidos > 0 ? `Cada extra ${extra}` : `Cada ingrediente ${extra}`);
  if (armado.max !== null) partes.push(`Máximo ${armado.max}`);
  return partes.join('. ');
}

/** "3 elegidos: 1 extra" */
export function contadorIngredientes(elegidos: number, incluidos: number): string {
  const extras = extrasDeIngredientes(elegidos, incluidos);
  const texto = `${elegidos} ${elegidos === 1 ? 'elegido' : 'elegidos'}`;
  return extras > 0 ? `${texto}: ${extras} extra` : texto;
}

// Precio y validación

/**
 * precioUnitario = precio del tamaño (o base)
 *                + max(0, ingredientes elegidos − incluidos) × precio por extra
 *                + Σ precio extra de los modificadores
 */
export function precioUnitario(
  precioBase: Centavos,
  modificadores: ModificadorElegido[],
  ingredientes?: Pick<IngredientesElegidos, 'extras' | 'precioExtra'>,
): Centavos {
  const porIngredientes = ingredientes ? ingredientes.extras * ingredientes.precioExtra : 0;
  return modificadores.reduce((suma, m) => suma + m.precioExtra, precioBase + porIngredientes);
}

/** Qué falta para poder agregar (vacío si está completo). El primer mensaje va en el botón. */
export function validarEleccion(
  producto: Producto,
  catalogo: { grupos: GrupoModificadores[]; ingredientes: Ingrediente[] },
  eleccion: Eleccion,
): string[] {
  const errores: string[] = [];
  if (producto.tamanos.length > 0 && !tamanoDe(producto, eleccion.tamanoId)) errores.push('Elige el tamaño');
  const armado = producto.armado;
  if (armado) {
    const posibles = ingredientesDelProducto(producto, catalogo.ingredientes);
    const ids = eleccion.ingredientesIds;
    if (!ids.every((id) => posibles.some((i) => i.id === id && i.disponible))) {
      errores.push('Un ingrediente ya no está disponible');
    } else if (ids.length < armado.min) {
      errores.push(
        armado.min === 1 ? 'Elige al menos 1 ingrediente' : `Elige al menos ${armado.min} ingredientes`,
      );
    } else if (armado.max !== null && ids.length > armado.max) {
      errores.push(`Elige máximo ${armado.max} ingredientes`);
    }
  }
  errores.push(
    ...validarSeleccion(gruposDelProducto(producto, catalogo.grupos), eleccion.seleccion).map(
      (e) => e.mensaje,
    ),
  );
  return errores;
}

// Texto de la línea (carrito, ticket, devoluciones)

type LineaMostrable = Pick<LineaVenta, 'nombre' | 'tamano' | 'ingredientes' | 'modificadores'>;

/** "Crepa dulce Grande" */
export function nombreLinea(linea: LineaMostrable): string {
  return linea.tamano ? `${linea.nombre} ${linea.tamano.nombre}` : linea.nombre;
}

/** "Nutella, Plátano, Fresa, Nuez (2 extra) · Helado" */
export function detalleLinea(linea: LineaMostrable): string {
  const partes: string[] = [];
  const ing = linea.ingredientes;
  if (ing && ing.nombres.length > 0) {
    partes.push(`${ing.nombres.join(', ')}${ing.extras > 0 ? ` (${ing.extras} extra)` : ''}`);
  }
  const modificadores = resumenModificadores(linea.modificadores);
  if (modificadores) partes.push(modificadores);
  return partes.join(' · ');
}
