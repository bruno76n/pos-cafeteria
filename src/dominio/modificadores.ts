import type { Centavos } from './dinero';
import type { GrupoModificadores, LineaVenta, Producto } from './tipos';

/** Opciones elegidas por grupo: grupoId → ids de opción. */
export type Seleccion = Record<string, string[]>;

export type ModificadorElegido = LineaVenta['modificadores'][number];

/** Grupos de un producto, en el orden en que se asignaron. Ignora los que ya no existen. */
export function gruposDelProducto(producto: Producto, grupos: GrupoModificadores[]): GrupoModificadores[] {
  const porId = new Map(grupos.map((g) => [g.id, g]));
  return producto.gruposIds.flatMap((id) => {
    const g = porId.get(id);
    return g ? [g] : [];
  });
}

/** Mínimo de opciones que exige un grupo. */
export function minimoDelGrupo(grupo: GrupoModificadores): number {
  return grupo.obligatorio ? Math.max(grupo.min, 1) : grupo.min;
}

/** Máximo de opciones de un grupo (uno si es de una sola opción). */
export function maximoDelGrupo(grupo: GrupoModificadores): number {
  return grupo.tipo === 'unico' ? 1 : grupo.max;
}

/** Opciones por defecto (solo disponibles) de cada grupo. */
export function seleccionPorDefecto(grupos: GrupoModificadores[]): Seleccion {
  return Object.fromEntries(
    grupos.map((g) => {
      const ids = g.opciones.filter((o) => o.porDefecto && o.disponible).map((o) => o.id);
      return [g.id, ids.slice(0, maximoDelGrupo(g))];
    }),
  );
}

/**
 * Toca una opción. En grupos de una opción la reemplaza (o la quita si el grupo es opcional);
 * en grupos de varias la alterna, sin pasar del máximo.
 */
export function alternarOpcion(grupo: GrupoModificadores, seleccion: Seleccion, opcionId: string): Seleccion {
  const opcion = grupo.opciones.find((o) => o.id === opcionId);
  if (!opcion?.disponible) return seleccion;
  const actuales = seleccion[grupo.id] ?? [];
  const elegida = actuales.includes(opcionId);
  let nuevas: string[];
  if (grupo.tipo === 'unico') {
    if (elegida) {
      if (minimoDelGrupo(grupo) > 0) return seleccion;
      nuevas = [];
    } else {
      nuevas = [opcionId];
    }
  } else if (elegida) {
    nuevas = actuales.filter((id) => id !== opcionId);
  } else {
    if (actuales.length >= maximoDelGrupo(grupo)) return seleccion;
    nuevas = [...actuales, opcionId];
  }
  return { ...seleccion, [grupo.id]: nuevas };
}

/** ¿Se puede agregar otra opción a este grupo? (para apagar botones al llegar al máximo) */
export function puedeAgregarOpcion(grupo: GrupoModificadores, seleccion: Seleccion): boolean {
  return grupo.tipo === 'unico' || (seleccion[grupo.id] ?? []).length < maximoDelGrupo(grupo);
}

export interface ErrorModificador {
  grupoId: string;
  mensaje: string;
}

/** Revisa obligatorio, mínimo, máximo y que las opciones existan y estén disponibles. */
export function validarSeleccion(grupos: GrupoModificadores[], seleccion: Seleccion): ErrorModificador[] {
  const errores: ErrorModificador[] = [];
  for (const g of grupos) {
    const ids = seleccion[g.id] ?? [];
    const validas = ids.filter((id) => g.opciones.some((o) => o.id === id && o.disponible));
    const min = minimoDelGrupo(g);
    const max = maximoDelGrupo(g);
    if (validas.length !== ids.length) {
      errores.push({ grupoId: g.id, mensaje: `Una opción de ${g.nombre} ya no está disponible` });
    } else if (validas.length < min) {
      errores.push({
        grupoId: g.id,
        mensaje: min === 1 ? `Elige ${g.nombre.toLowerCase()}` : `Elige al menos ${min} en ${g.nombre}`,
      });
    } else if (validas.length > max) {
      errores.push({ grupoId: g.id, mensaje: `Elige máximo ${max} en ${g.nombre}` });
    }
  }
  return errores;
}

/** Copia de las opciones elegidas (grupo, opción, precio extra), en orden de grupo y de opción. */
export function modificadoresElegidos(
  grupos: GrupoModificadores[],
  seleccion: Seleccion,
): ModificadorElegido[] {
  return grupos.flatMap((g) => {
    const ids = seleccion[g.id] ?? [];
    return g.opciones
      .filter((o) => ids.includes(o.id))
      .map((o) => ({ grupo: g.nombre, opcion: o.nombre, precioExtra: o.precioExtra }));
  });
}

/** precioUnitario = precioBase + Σ precioExtra */
export function precioUnitario(precioBase: Centavos, modificadores: ModificadorElegido[]): Centavos {
  return modificadores.reduce((suma, m) => suma + m.precioExtra, precioBase);
}

/** "Mediano 16 oz, Almendra, 1 shot extra" */
export function resumenModificadores(modificadores: ModificadorElegido[]): string {
  return modificadores.map((m) => m.opcion).join(', ');
}

/** Clave estable de una selección, para fusionar líneas idénticas. */
export function claveSeleccion(seleccion: Seleccion): string {
  return Object.keys(seleccion)
    .sort()
    .filter((g) => (seleccion[g] ?? []).length > 0)
    .map((g) => `${g}:${[...(seleccion[g] ?? [])].sort().join(',')}`)
    .join('|');
}

/** "(elige 1)", "(opcional)", "(hasta 2)", "(elige de 1 a 3)". */
export function indicacionGrupo(grupo: GrupoModificadores): string {
  const min = minimoDelGrupo(grupo);
  const max = maximoDelGrupo(grupo);
  if (grupo.tipo === 'unico') return min > 0 ? '(elige 1)' : '(opcional)';
  if (min === 0) return `(hasta ${max})`;
  return min === max ? `(elige ${min})` : `(elige de ${min} a ${max})`;
}
