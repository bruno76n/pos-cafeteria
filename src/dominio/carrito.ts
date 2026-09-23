import { redondear, type Centavos } from './dinero.js';
import { claveSeleccion, gruposDelProducto, modificadoresElegidos } from './modificadores.js';
import {
  ingredientesElegidos,
  precioBaseDe,
  precioUnitario,
  tamanoDe,
  type Eleccion,
} from './personalizacion.js';
import type {
  Categoria,
  ConfigGeneral,
  GrupoModificadores,
  Ingrediente,
  LineaVenta,
  Producto,
  RefUsuario,
} from './tipos.js';

/** Línea del carrito: la copia que irá a la venta más lo elegido, para poder editarla. */
export interface LineaCarrito extends LineaVenta, Eleccion {}

export interface DescuentoCarrito {
  tipo: 'porcentaje' | 'monto';
  /** Porcentaje (0–100) o monto en centavos. */
  valor: number;
  motivo: string | null;
  autorizadoPor: RefUsuario | null;
}

export interface Carrito {
  lineas: LineaCarrito[];
  cliente: string | null;
  descuento: DescuentoCarrito | null;
}

export type ConfigVentas = ConfigGeneral['ventas'];

export interface Totales {
  subtotal: Centavos;
  descuento: Centavos;
  neto: Centavos;
  iva: { tasa: number; incluido: boolean; base: Centavos; monto: Centavos };
  total: Centavos;
}

export const carritoVacio = (): Carrito => ({ lineas: [], cliente: null, descuento: null });

/** Un carrito guardado por una versión anterior no trae tamaño ni ingredientes en sus líneas. */
export function completarCarrito(guardado: Carrito): Carrito {
  return {
    ...guardado,
    lineas: guardado.lineas.map((l) => ({
      ...l,
      tamanoId: l.tamanoId ?? null,
      ingredientesIds: l.ingredientesIds ?? [],
    })),
  };
}

/**
 * Arma una línea con copia de nombre, tamaño, ingredientes, precios y modificadores (nunca
 * referencias vivas al menú). Sin tamaño elegido toma el primero del producto.
 */
export function crearLinea(params: {
  producto: Producto;
  categoria: Categoria | undefined;
  grupos: GrupoModificadores[];
  /** Catálogo de ingredientes (solo lo usan los productos que se arman). */
  ingredientes?: Ingrediente[];
  eleccion?: Partial<Eleccion>;
  cantidad?: number;
  nota?: string | null;
  id?: string;
}): LineaCarrito {
  const { producto, categoria, cantidad = 1 } = params;
  const seleccion = params.eleccion?.seleccion ?? {};
  const tamano = tamanoDe(producto, params.eleccion?.tamanoId ?? producto.tamanos[0]?.id ?? null);
  const tamanoId = tamano?.id ?? null;
  const ingredientesIds = params.eleccion?.ingredientesIds ?? [];
  const precioBase = precioBaseDe(producto, tamanoId);
  const ingredientes = ingredientesElegidos(producto, params.ingredientes ?? [], {
    tamanoId,
    ingredientesIds,
  });
  const modificadores = modificadoresElegidos(gruposDelProducto(producto, params.grupos), seleccion);
  const unitario = precioUnitario(precioBase, modificadores, ingredientes);
  const nota = params.nota?.trim() || null;
  return {
    id: params.id ?? crypto.randomUUID(),
    productoId: producto.id,
    nombre: producto.nombre,
    categoriaId: producto.categoriaId,
    categoriaNombre: categoria?.nombre ?? '',
    precioBase,
    ...(tamano ? { tamano: { nombre: tamano.nombre, precio: tamano.precio } } : {}),
    ...(ingredientes ? { ingredientes } : {}),
    modificadores,
    precioUnitario: unitario,
    cantidad,
    nota,
    importe: unitario * cantidad,
    tamanoId,
    ingredientesIds,
    seleccion,
  };
}

const conCantidad = (linea: LineaCarrito, cantidad: number): LineaCarrito => ({
  ...linea,
  cantidad,
  importe: linea.precioUnitario * cantidad,
});

const claveIngredientes = (l: LineaCarrito) => [...l.ingredientesIds].sort().join(',');

/** Mismo producto, tamaño, ingredientes y opciones, mismo precio y sin nota. */
function sonIdenticas(a: LineaCarrito, b: LineaCarrito): boolean {
  return (
    a.productoId === b.productoId &&
    a.tamanoId === b.tamanoId &&
    claveIngredientes(a) === claveIngredientes(b) &&
    a.nota === null &&
    b.nota === null &&
    a.precioUnitario === b.precioUnitario &&
    claveSeleccion(a.seleccion) === claveSeleccion(b.seleccion)
  );
}

/** Agrega una línea; si ya hay una idéntica, le suma la cantidad. */
export function agregarLinea(carrito: Carrito, linea: LineaCarrito): Carrito {
  const igual = carrito.lineas.find((l) => sonIdenticas(l, linea));
  if (igual) {
    return {
      ...carrito,
      lineas: carrito.lineas.map((l) => (l === igual ? conCantidad(l, l.cantidad + linea.cantidad) : l)),
    };
  }
  return { ...carrito, lineas: [...carrito.lineas, linea] };
}

/** Reemplaza una línea editada (se fusiona si quedó idéntica a otra). */
export function reemplazarLinea(carrito: Carrito, lineaId: string, nueva: LineaCarrito): Carrito {
  const sinLinea = { ...carrito, lineas: carrito.lineas.filter((l) => l.id !== lineaId) };
  const igual = sinLinea.lineas.find((l) => sonIdenticas(l, nueva));
  if (igual) return agregarLinea(sinLinea, nueva);
  const i = carrito.lineas.findIndex((l) => l.id === lineaId);
  const lineas = [...sinLinea.lineas];
  lineas.splice(i < 0 ? lineas.length : i, 0, { ...nueva, id: lineaId });
  return { ...carrito, lineas };
}

/** Suma o resta a la cantidad. Si llega a cero, la línea se elimina. */
export function cambiarCantidad(carrito: Carrito, lineaId: string, delta: number): Carrito {
  return {
    ...carrito,
    lineas: carrito.lineas.flatMap((l) => {
      if (l.id !== lineaId) return [l];
      const cantidad = l.cantidad + delta;
      return cantidad > 0 ? [conCantidad(l, cantidad)] : [];
    }),
  };
}

export function eliminarLinea(carrito: Carrito, lineaId: string): Carrito {
  return { ...carrito, lineas: carrito.lineas.filter((l) => l.id !== lineaId) };
}

export function ponerNota(carrito: Carrito, lineaId: string, nota: string | null): Carrito {
  const limpia = nota?.trim() || null;
  return { ...carrito, lineas: carrito.lineas.map((l) => (l.id === lineaId ? { ...l, nota: limpia } : l)) };
}

export function ponerCliente(carrito: Carrito, cliente: string | null): Carrito {
  return { ...carrito, cliente: cliente?.trim() ? cliente : null };
}

export function ponerDescuento(carrito: Carrito, descuento: DescuentoCarrito | null): Carrito {
  return { ...carrito, descuento };
}

export function cantidadDeProductos(carrito: Carrito): number {
  return carrito.lineas.reduce((n, l) => n + l.cantidad, 0);
}

/** Porcentaje: redondear(subtotal × p / 100). Monto: min(m, subtotal). */
export function importeDescuento(subtotal: Centavos, descuento: DescuentoCarrito | null): Centavos {
  if (!descuento) return 0;
  const importe =
    descuento.tipo === 'porcentaje'
      ? redondear((subtotal * Math.min(descuento.valor, 100)) / 100)
      : Math.min(redondear(descuento.valor), subtotal);
  return Math.max(0, importe);
}

/** Error del descuento según la configuración, o null si se puede aplicar. */
export function validarDescuento(
  descuento: DescuentoCarrito,
  subtotal: Centavos,
  config: ConfigVentas,
): string | null {
  if (!config.descuentosPermitidos) return 'Los descuentos están desactivados.';
  if (!(descuento.valor > 0)) return 'Escribe el descuento.';
  const tope = config.descuentoMaximoPorcentaje;
  if (descuento.tipo === 'porcentaje') {
    return descuento.valor > tope ? `El descuento máximo es ${tope} %.` : null;
  }
  return importeDescuento(subtotal, descuento) > redondear((subtotal * tope) / 100)
    ? `El descuento máximo es ${tope} % de la venta.`
    : null;
}

/** Subtotal, descuento, IVA (incluido o no) y total. */
export function calcularTotales(
  lineas: Pick<LineaVenta, 'importe'>[],
  descuento: DescuentoCarrito | null,
  config: ConfigVentas,
): Totales {
  const subtotal = lineas.reduce((s, l) => s + l.importe, 0);
  const desc = importeDescuento(subtotal, descuento);
  const neto = subtotal - desc;
  const tasa = config.tasaIVA;
  if (config.preciosIncluyenIVA) {
    const base = redondear(neto / (1 + tasa));
    return {
      subtotal,
      descuento: desc,
      neto,
      iva: { tasa, incluido: true, base, monto: neto - base },
      total: neto,
    };
  }
  const monto = redondear(neto * tasa);
  return {
    subtotal,
    descuento: desc,
    neto,
    iva: { tasa, incluido: false, base: neto, monto },
    total: neto + monto,
  };
}

/** Líneas listas para guardarse en la venta (sin lo elegido, que solo sirve para editar). */
export function lineasParaVenta(carrito: Carrito): LineaVenta[] {
  return carrito.lineas.map(
    ({ seleccion: _seleccion, tamanoId: _tamanoId, ingredientesIds: _ingredientesIds, ...linea }) => linea,
  );
}
