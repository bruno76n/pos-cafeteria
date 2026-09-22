import { describe, expect, test } from 'vitest';
import {
  agregarLinea,
  calcularTotales,
  cambiarCantidad,
  cantidadDeProductos,
  carritoVacio,
  completarCarrito,
  crearLinea,
  eliminarLinea,
  lineasParaVenta,
  ponerCliente,
  ponerDescuento,
  ponerNota,
  reemplazarLinea,
  validarDescuento,
  type Carrito,
  type LineaCarrito,
} from './carrito';
import {
  categoriaPrueba,
  configPrueba,
  gruposPrueba,
  ingredientesPrueba,
  productoPrueba,
} from './datosPrueba';
import { seleccionPorDefecto, gruposDelProducto } from './modificadores';

const cafes = categoriaPrueba('cafes');
const postres = categoriaPrueba('postres');
const latte = productoPrueba('latte');
const brownie = productoPrueba('brownie');
const eleccionLatte = {
  tamanoId: 'mediano',
  seleccion: { ...seleccionPorDefecto(gruposDelProducto(latte, gruposPrueba)), leche: ['almendra'] },
};

const lineaLatte = (cantidad = 1) =>
  crearLinea({
    producto: latte,
    categoria: cafes,
    grupos: gruposPrueba,
    eleccion: eleccionLatte,
    cantidad,
  });
const lineaCrepa = (ingredientesIds: string[], tamanoId = 'grande') =>
  crearLinea({
    producto: productoPrueba('crepa-dulce'),
    categoria: categoriaPrueba('crepas'),
    grupos: gruposPrueba,
    ingredientes: ingredientesPrueba,
    eleccion: { tamanoId, ingredientesIds },
  });
const lineaBrownie = () => crearLinea({ producto: brownie, categoria: postres, grupos: gruposPrueba });

/** Caso A: 2 Latte mediano con almendra + 1 Brownie. */
function casoA(): Carrito {
  return agregarLinea(agregarLinea(carritoVacio(), lineaLatte(2)), lineaBrownie());
}

const ivaIncluido = configPrueba.ventas;
const ivaNoIncluido = { ...configPrueba.ventas, preciosIncluyenIVA: false };
const diezPorCiento = { tipo: 'porcentaje' as const, valor: 10, motivo: null, autorizadoPor: null };

describe('líneas', () => {
  test('la línea copia nombre, categoría, tamaño, precios y modificadores', () => {
    const l = lineaLatte(2);
    expect(l).toMatchObject({
      productoId: 'latte',
      nombre: 'Latte',
      categoriaNombre: 'Cafés',
      precioBase: 7500,
      tamano: { nombre: 'Mediano 16 oz', precio: 7500 },
      precioUnitario: 8500,
      cantidad: 2,
      importe: 17000,
      nota: null,
    });
    expect(l.modificadores.map((m) => m.opcion)).toEqual(['Almendra']);
  });

  test('sin tamaño elegido toma el primero; sin tamaños usa el precio base', () => {
    const l = crearLinea({ producto: latte, categoria: cafes, grupos: gruposPrueba });
    expect(l).toMatchObject({ tamanoId: 'chico', tamano: { nombre: 'Chico 12 oz' }, precioUnitario: 6500 });
    const b = lineaBrownie();
    expect(b).toMatchObject({ tamanoId: null, precioBase: 4500, precioUnitario: 4500 });
    expect(b).not.toHaveProperty('tamano');
  });

  test('crepa Grande con 4 ingredientes: copia tamaño e ingredientes y cobra 2 extra', () => {
    const l = lineaCrepa(['nutella', 'platano', 'fresa', 'nuez']);
    expect(l).toMatchObject({
      nombre: 'Crepa dulce',
      precioBase: 7500,
      tamano: { nombre: 'Grande', precio: 7500 },
      ingredientes: {
        nombres: ['Nutella', 'Plátano', 'Fresa', 'Nuez'],
        incluidos: 2,
        extras: 2,
        precioExtra: 500,
      },
      precioUnitario: 8500,
    });
    expect(lineaBrownie()).not.toHaveProperty('ingredientes');
  });

  test('crepas con los mismos ingredientes (en otro orden) se fusionan; con otros, no', () => {
    let c = agregarLinea(carritoVacio(), lineaCrepa(['nutella', 'fresa']));
    c = agregarLinea(c, lineaCrepa(['fresa', 'nutella']));
    c = agregarLinea(c, lineaCrepa(['nutella', 'nuez']));
    c = agregarLinea(c, lineaCrepa(['nutella', 'fresa'], 'chica'));
    expect(c.lineas.map((l) => l.cantidad)).toEqual([2, 1, 1]);
  });

  test('un carrito guardado antes de los tamaños se completa al cargarlo', () => {
    const { tamanoId: _t, ingredientesIds: _i, ...vieja } = lineaBrownie();
    const c = completarCarrito({ ...carritoVacio(), lineas: [vieja as LineaCarrito] });
    expect(c.lineas[0]).toMatchObject({ tamanoId: null, ingredientesIds: [] });
    expect(agregarLinea(c, lineaBrownie()).lineas).toHaveLength(1);
  });

  test('las líneas para la venta no llevan lo elegido', () => {
    const [l] = lineasParaVenta({ ...carritoVacio(), lineas: [lineaLatte()] });
    expect(l).not.toHaveProperty('tamanoId');
    expect(l).not.toHaveProperty('ingredientesIds');
    expect(l).not.toHaveProperty('seleccion');
    expect(l).toHaveProperty('tamano');
  });

  test('tocar dos veces un producto sin modificadores suma a la misma línea', () => {
    const c = agregarLinea(agregarLinea(carritoVacio(), lineaBrownie()), lineaBrownie());
    expect(c.lineas).toHaveLength(1);
    expect(c.lineas[0]).toMatchObject({ cantidad: 2, importe: 9000 });
  });

  test('mismo producto con otras opciones o con nota va en otra línea', () => {
    let c = agregarLinea(carritoVacio(), lineaLatte());
    c = agregarLinea(
      c,
      crearLinea({
        producto: latte,
        categoria: cafes,
        grupos: gruposPrueba,
        eleccion: { tamanoId: 'grande' },
      }),
    );
    c = agregarLinea(
      c,
      crearLinea({
        producto: latte,
        categoria: cafes,
        grupos: gruposPrueba,
        eleccion: eleccionLatte,
        nota: 'sin espuma',
      }),
    );
    c = agregarLinea(c, lineaLatte());
    expect(c.lineas.map((l) => l.cantidad)).toEqual([2, 1, 1]);
  });

  test('cantidad, eliminar y nota', () => {
    let c = casoA();
    const idLatte = c.lineas[0]!.id;
    c = cambiarCantidad(c, idLatte, 1);
    expect(c.lineas[0]).toMatchObject({ cantidad: 3, importe: 25500 });
    c = cambiarCantidad(c, idLatte, -3);
    expect(c.lineas.map((l) => l.nombre)).toEqual(['Brownie']);
    c = ponerNota(c, c.lineas[0]!.id, '  calientito ');
    expect(c.lineas[0]!.nota).toBe('calientito');
    c = eliminarLinea(c, c.lineas[0]!.id);
    expect(c.lineas).toEqual([]);
  });

  test('editar una línea conserva su lugar y su id', () => {
    const c = casoA();
    const id = c.lineas[0]!.id;
    const editada = reemplazarLinea(
      c,
      id,
      crearLinea({
        producto: latte,
        categoria: cafes,
        grupos: gruposPrueba,
        eleccion: { tamanoId: 'grande' },
        cantidad: 2,
      }),
    );
    expect(editada.lineas[0]).toMatchObject({ id, precioUnitario: 8500, cantidad: 2 });
    expect(editada.lineas[1]!.nombre).toBe('Brownie');
  });

  test('editar una línea para que quede igual a otra las fusiona', () => {
    let c = agregarLinea(carritoVacio(), lineaBrownie());
    c = agregarLinea(
      c,
      crearLinea({ producto: brownie, categoria: postres, grupos: [], nota: 'calientito' }),
    );
    const conNota = c.lineas[1]!;
    c = reemplazarLinea(c, conNota.id, { ...conNota, nota: null });
    expect(c.lineas).toHaveLength(1);
    expect(c.lineas[0]!.cantidad).toBe(2);
  });

  test('cliente, cantidad total y líneas para la venta', () => {
    let c = ponerCliente(casoA(), 'Luis');
    expect(c.cliente).toBe('Luis');
    expect(ponerCliente(c, '  ').cliente).toBeNull();
    expect(cantidadDeProductos(c)).toBe(3);
    c = ponerDescuento(c, diezPorCiento);
    const lineas = lineasParaVenta(c);
    expect(lineas[0]).not.toHaveProperty('seleccion');
  });

  test('un cambio de precio del menú no afecta la línea', () => {
    const l = lineaBrownie();
    const c = agregarLinea(carritoVacio(), l);
    brownie.precio = 9999;
    expect(c.lineas[0]!.precioUnitario).toBe(4500);
    brownie.precio = 4500;
  });
});

describe('totales', () => {
  test('caso A: subtotal $215.00', () => {
    const t = calcularTotales(casoA().lineas, null, ivaIncluido);
    expect(t.subtotal).toBe(21500);
    expect(t.total).toBe(21500);
  });

  test('caso B: 10 % con IVA incluido', () => {
    const t = calcularTotales(casoA().lineas, diezPorCiento, ivaIncluido);
    expect(t).toEqual({
      subtotal: 21500,
      descuento: 2150,
      neto: 19350,
      iva: { tasa: 0.16, incluido: true, base: 16681, monto: 2669 },
      total: 19350,
    });
  });

  test('caso C: 10 % con IVA no incluido', () => {
    const t = calcularTotales(casoA().lineas, diezPorCiento, ivaNoIncluido);
    expect(t.iva.monto).toBe(3096);
    expect(t.total).toBe(22446);
  });

  test('caso G: descuento de $60 sobre $45 deja el total en cero', () => {
    const c = agregarLinea(carritoVacio(), lineaBrownie());
    const t = calcularTotales(
      c.lineas,
      { tipo: 'monto', valor: 6000, motivo: null, autorizadoPor: null },
      ivaIncluido,
    );
    expect(t.subtotal).toBe(4500);
    expect(t.descuento).toBe(4500);
    expect(t.total).toBe(0);
    expect(t.iva.monto).toBe(0);
  });

  test('carrito vacío', () => {
    expect(calcularTotales([], null, ivaIncluido).total).toBe(0);
  });
});

describe('tope de descuento', () => {
  const config = { ...ivaIncluido, descuentoMaximoPorcentaje: 50 };
  test('porcentaje dentro y fuera del tope', () => {
    expect(validarDescuento({ ...diezPorCiento, valor: 50 }, 21500, config)).toBeNull();
    expect(validarDescuento({ ...diezPorCiento, valor: 51 }, 21500, config)).toBe(
      'El descuento máximo es 50 %.',
    );
  });
  test('monto contra el tope en porcentaje del subtotal', () => {
    expect(
      validarDescuento({ tipo: 'monto', valor: 10000, motivo: null, autorizadoPor: null }, 21500, config),
    ).toBeNull();
    expect(
      validarDescuento({ tipo: 'monto', valor: 11000, motivo: null, autorizadoPor: null }, 21500, config),
    ).toMatch(/máximo/);
  });
  test('descuentos desactivados o vacíos', () => {
    expect(validarDescuento(diezPorCiento, 21500, { ...config, descuentosPermitidos: false })).toMatch(
      /desactivados/,
    );
    expect(validarDescuento({ ...diezPorCiento, valor: 0 }, 21500, config)).toMatch(/Escribe/);
  });
});
