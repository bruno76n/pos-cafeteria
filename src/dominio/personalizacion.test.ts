import { describe, expect, test } from 'vitest';
import { gruposPrueba, productoPrueba } from './datosPrueba';
import { gruposDelProducto, modificadoresElegidos, seleccionPorDefecto } from './modificadores';
import {
  detalleLinea,
  nombreLinea,
  precioBaseDe,
  precioDesde,
  precioUnitario,
  sePersonaliza,
  tamanoInicial,
  textoPrecio,
  validarEleccion,
} from './personalizacion';

const latte = productoPrueba('latte');
const brownie = productoPrueba('brownie');
const gruposLatte = gruposDelProducto(latte, gruposPrueba);

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
  test('con tamaños o modificadores se abre la hoja; sin nada se agrega directo', () => {
    expect(sePersonaliza(latte, gruposPrueba)).toBe(true);
    expect(sePersonaliza({ ...brownie, tamanos: latte.tamanos }, gruposPrueba)).toBe(true);
    expect(sePersonaliza(brownie, gruposPrueba)).toBe(false);
  });
  test('sin tamaño elegido no se puede agregar', () => {
    const seleccion = seleccionPorDefecto(gruposLatte);
    expect(validarEleccion(latte, gruposPrueba, { tamanoId: null, seleccion })).toEqual(['Elige el tamaño']);
    expect(validarEleccion(latte, gruposPrueba, { tamanoId: 'jumbo', seleccion })).toEqual([
      'Elige el tamaño',
    ]);
    expect(validarEleccion(latte, gruposPrueba, { tamanoId: 'chico', seleccion })).toEqual([]);
  });
});

describe('precio unitario', () => {
  test('Latte Mediano $75 + leche de almendra $10 = $85', () => {
    const seleccion = { ...seleccionPorDefecto(gruposLatte), leche: ['almendra'] };
    const mods = modificadoresElegidos(gruposLatte, seleccion);
    expect(precioUnitario(precioBaseDe(latte, 'mediano'), mods)).toBe(8500);
  });
});

describe('texto de la línea', () => {
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
