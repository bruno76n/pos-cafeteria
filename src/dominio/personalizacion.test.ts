import { describe, expect, test } from 'vitest';
import { gruposPrueba, ingredientesPrueba, productoPrueba } from './datosPrueba';
import { gruposDelProducto, modificadoresElegidos, seleccionPorDefecto } from './modificadores';
import {
  alternarIngrediente,
  contadorIngredientes,
  detalleLinea,
  incluidosDe,
  indicacionIngredientes,
  ingredientesDelProducto,
  ingredientesElegidos,
  nombreLinea,
  precioBaseDe,
  precioDesde,
  precioUnitario,
  puedeAgregarIngrediente,
  sePersonaliza,
  tamanoInicial,
  textoPrecio,
  validarEleccion,
  type Eleccion,
} from './personalizacion';

const latte = productoPrueba('latte');
const brownie = productoPrueba('brownie');
const gruposLatte = gruposDelProducto(latte, gruposPrueba);
const crepa = productoPrueba('crepa-dulce');
const catalogo = { grupos: gruposPrueba, ingredientes: ingredientesPrueba };
const eleccion = (cambios: Partial<Eleccion>): Eleccion => ({
  tamanoId: null,
  ingredientesIds: [],
  seleccion: {},
  ...cambios,
});

/** Precio unitario de la crepa con los ingredientes y el tamaño dados. */
function precioCrepa(tamanoId: string, ingredientesIds: string[]) {
  const ingredientes = ingredientesElegidos(crepa, ingredientesPrueba, { tamanoId, ingredientesIds });
  return precioUnitario(precioBaseDe(crepa, tamanoId), [], ingredientes);
}

describe('tamaños', () => {
  test('el primero viene elegido y el precio sale del tamaño', () => {
    expect(tamanoInicial(latte)).toBe('chico');
    expect(precioBaseDe(latte, 'mediano')).toBe(7500);
    expect(tamanoInicial(brownie)).toBeNull();
    expect(precioBaseDe(brownie, null)).toBe(4500);
  });
  test('"Desde" el tamaño más barato, aunque no sea el primero', () => {
    const p = { ...latte, tamanos: [...latte.tamanos].reverse() };
    expect(precioDesde(p)).toBe(6500);
    expect(textoPrecio(p)).toBe('Desde $65.00');
    expect(textoPrecio(brownie)).toBe('$45.00');
  });
  test('con tamaños, ingredientes o modificadores se abre la hoja; sin nada se agrega directo', () => {
    expect(sePersonaliza(latte, gruposPrueba)).toBe(true);
    expect(sePersonaliza({ ...crepa, tamanos: [], gruposIds: [] }, gruposPrueba)).toBe(true);
    expect(sePersonaliza({ ...brownie, tamanos: latte.tamanos }, gruposPrueba)).toBe(true);
    expect(sePersonaliza(brownie, gruposPrueba)).toBe(false);
  });
  test('sin tamaño elegido no se puede agregar', () => {
    const seleccion = seleccionPorDefecto(gruposLatte);
    expect(validarEleccion(latte, catalogo, eleccion({ seleccion }))).toEqual(['Elige el tamaño']);
    expect(validarEleccion(latte, catalogo, eleccion({ tamanoId: 'jumbo', seleccion }))).toEqual([
      'Elige el tamaño',
    ]);
    expect(validarEleccion(latte, catalogo, eleccion({ tamanoId: 'chico', seleccion }))).toEqual([]);
  });
});

describe('precio unitario', () => {
  test('Latte Mediano $75 + leche de almendra $10 = $85', () => {
    const seleccion = { ...seleccionPorDefecto(gruposLatte), leche: ['almendra'] };
    const mods = modificadoresElegidos(gruposLatte, seleccion);
    expect(precioUnitario(precioBaseDe(latte, 'mediano'), mods)).toBe(8500);
  });
});

describe('ingredientes', () => {
  test('solo los permitidos, en orden del catálogo; con permitidos null, todos', () => {
    const dulces = ingredientesDelProducto(crepa, ingredientesPrueba);
    expect(dulces.map((i) => i.id)).toEqual(
      ingredientesPrueba.filter((i) => i.grupo === 'Dulces').map((i) => i.id),
    );
    const todos = { ...crepa, armado: { ...crepa.armado!, permitidos: null } };
    expect(ingredientesDelProducto(todos, [...ingredientesPrueba].reverse())).toEqual(ingredientesPrueba);
    expect(ingredientesDelProducto(latte, ingredientesPrueba)).toEqual([]);
  });
  test('incluidos del tamaño elegido; sin tamaños, los del producto', () => {
    const salada = productoPrueba('crepa-salada');
    expect(incluidosDe(salada, 'chica')).toBe(2);
    expect(incluidosDe(salada, 'grande')).toBe(3);
    expect(incluidosDe({ ...crepa, tamanos: [] }, null)).toBe(2);
    expect(incluidosDe(latte, 'chico')).toBe(0);
  });
  test('con máximo 5 no deja elegir un sexto; quitar sí se puede', () => {
    let elegidos: string[] = [];
    for (const id of ['nutella', 'cajeta', 'platano', 'fresa', 'nuez']) {
      elegidos = alternarIngrediente(crepa, ingredientesPrueba, elegidos, id);
    }
    expect(elegidos).toHaveLength(5);
    expect(puedeAgregarIngrediente(crepa, elegidos)).toBe(false);
    expect(alternarIngrediente(crepa, ingredientesPrueba, elegidos, 'durazno')).toBe(elegidos);
    expect(alternarIngrediente(crepa, ingredientesPrueba, elegidos, 'nuez')).toHaveLength(4);
    const seis = [...elegidos, 'durazno'];
    expect(validarEleccion(crepa, catalogo, eleccion({ tamanoId: 'grande', ingredientesIds: seis }))).toEqual(
      ['Elige máximo 5 ingredientes'],
    );
  });
  test('con mínimo 1 no deja agregar sin ingredientes', () => {
    expect(validarEleccion(crepa, catalogo, eleccion({ tamanoId: 'chica' }))).toEqual([
      'Elige al menos 1 ingrediente',
    ]);
    const conDos = { ...crepa, armado: { ...crepa.armado!, min: 2 } };
    expect(
      validarEleccion(conDos, catalogo, eleccion({ tamanoId: 'chica', ingredientesIds: ['nuez'] })),
    ).toEqual(['Elige al menos 2 ingredientes']);
    expect(
      validarEleccion(crepa, catalogo, eleccion({ tamanoId: 'chica', ingredientesIds: ['nuez'] })),
    ).toEqual([]);
  });
  test('los no disponibles o no permitidos no se eligen', () => {
    const sinFresa = ingredientesPrueba.map((i) => (i.id === 'fresa' ? { ...i, disponible: false } : i));
    expect(alternarIngrediente(crepa, sinFresa, [], 'fresa')).toEqual([]);
    expect(alternarIngrediente(crepa, ingredientesPrueba, [], 'jamon')).toEqual([]);
    const conFresa = eleccion({ tamanoId: 'chica', ingredientesIds: ['fresa'] });
    expect(validarEleccion(crepa, { ...catalogo, ingredientes: sinFresa }, conFresa)).toEqual([
      'Un ingrediente ya no está disponible',
    ]);
  });
  test('textos de la hoja', () => {
    expect(indicacionIngredientes(crepa, 'grande')).toBe('Incluye 2. Cada extra +$5.00. Máximo 5');
    const sinIncluidos = { ...crepa, tamanos: [], armado: { ...crepa.armado!, incluidos: 0, max: null } };
    expect(indicacionIngredientes(sinIncluidos, null)).toBe('Cada ingrediente +$5.00');
    expect(contadorIngredientes(3, 2)).toBe('3 elegidos: 1 extra');
    expect(contadorIngredientes(1, 2)).toBe('1 elegido');
  });
});

describe('precio de la crepa', () => {
  test('Crepa Grande $75 (incluye 2) con 4 ingredientes = $85', () => {
    expect(precioCrepa('grande', ['nutella', 'platano', 'fresa', 'nuez'])).toBe(8500);
  });
  test('Crepa Chica $55 (incluye 2) con 1 ingrediente = $55 (no descuenta)', () => {
    expect(precioCrepa('chica', ['nutella'])).toBe(5500);
  });
  test('la copia guarda nombres en orden del catálogo, incluidos, extras y precio del extra', () => {
    expect(
      ingredientesElegidos(crepa, ingredientesPrueba, {
        tamanoId: 'grande',
        ingredientesIds: ['nuez', 'fresa', 'platano', 'nutella'],
      }),
    ).toEqual({
      nombres: ['Nutella', 'Plátano', 'Fresa', 'Nuez'],
      incluidos: 2,
      extras: 2,
      precioExtra: 500,
    });
    expect(
      ingredientesElegidos(latte, ingredientesPrueba, { tamanoId: 'chico', ingredientesIds: [] }),
    ).toBeUndefined();
  });
  test('ingredientes extra y modificadores se suman', () => {
    const extras = { extras: 2, precioExtra: 500 };
    const mods = [{ grupo: 'Toppings', opcion: 'Crema batida', precioExtra: 1000 }];
    expect(precioUnitario(7500, mods, extras)).toBe(9500);
  });
});

describe('texto de la línea', () => {
  test('crepa: "Crepa dulce Grande" y "Nutella, Plátano, Fresa, Nuez (2 extra)"', () => {
    const linea = {
      nombre: 'Crepa dulce',
      tamano: { nombre: 'Grande', precio: 7500 },
      ingredientes: {
        nombres: ['Nutella', 'Plátano', 'Fresa', 'Nuez'],
        incluidos: 2,
        extras: 2,
        precioExtra: 500,
      },
      modificadores: [],
    };
    expect(nombreLinea(linea)).toBe('Crepa dulce Grande');
    expect(detalleLinea(linea)).toBe('Nutella, Plátano, Fresa, Nuez (2 extra)');
    expect(
      detalleLinea({
        ...linea,
        ingredientes: { ...linea.ingredientes, nombres: ['Nutella'], extras: 0 },
        modificadores: [{ grupo: 'Toppings', opcion: 'Canela', precioExtra: 0 }],
      }),
    ).toBe('Nutella · Canela');
  });
  test('nombre con tamaño y detalle de modificadores', () => {
    const linea = {
      nombre: 'Latte',
      tamano: { nombre: 'Mediano 16 oz', precio: 7500 },
      modificadores: [{ grupo: 'Leche', opcion: 'Almendra', precioExtra: 1000 }],
    };
    expect(nombreLinea(linea)).toBe('Latte Mediano 16 oz');
    expect(detalleLinea(linea)).toBe('Almendra');
  });
  test('una venta anterior a los tamaños se muestra igual que antes', () => {
    const linea = {
      nombre: 'Latte',
      modificadores: [
        { grupo: 'Tamaño', opcion: 'Mediano 16 oz', precioExtra: 1000 },
        { grupo: 'Leche', opcion: 'Almendra', precioExtra: 1000 },
      ],
    };
    expect(nombreLinea(linea)).toBe('Latte');
    expect(detalleLinea(linea)).toBe('Mediano 16 oz, Almendra');
  });
});
