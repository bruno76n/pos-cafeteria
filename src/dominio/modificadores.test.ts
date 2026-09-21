import { describe, expect, test } from 'vitest';
import { gruposPrueba, grupoPrueba, productoPrueba } from './datosPrueba';
import {
  alternarOpcion,
  claveSeleccion,
  gruposDelProducto,
  indicacionGrupo,
  modificadoresElegidos,
  precioUnitario,
  puedeAgregarOpcion,
  resumenModificadores,
  seleccionPorDefecto,
  validarSeleccion,
} from './modificadores';

const latte = productoPrueba('latte');
const gruposLatte = gruposDelProducto(latte, gruposPrueba);
const tamano = grupoPrueba('tamano');
const leche = grupoPrueba('leche');
const shot = grupoPrueba('extra-shot');
const jarabes = grupoPrueba('jarabes');

describe('selección por defecto', () => {
  test('toma las opciones marcadas por defecto, en el orden del producto', () => {
    expect(gruposLatte.map((g) => g.id)).toEqual(['tamano', 'leche', 'extra-shot', 'jarabes', 'toppings']);
    const sel = seleccionPorDefecto(gruposLatte);
    expect(sel).toEqual({
      tamano: ['chico'],
      leche: ['entera'],
      'extra-shot': [],
      jarabes: [],
      toppings: [],
    });
    expect(validarSeleccion(gruposLatte, sel)).toEqual([]);
  });
  test('ignora opciones por defecto no disponibles', () => {
    const g = { ...tamano, opciones: tamano.opciones.map((o) => ({ ...o, disponible: o.id !== 'chico' })) };
    expect(seleccionPorDefecto([g])).toEqual({ tamano: [] });
    expect(validarSeleccion([g], { tamano: [] })).toEqual([{ grupoId: 'tamano', mensaje: 'Elige tamaño' }]);
  });
});

describe('alternar opciones', () => {
  test('una opción reemplaza y no se puede quitar si es obligatoria', () => {
    let sel = seleccionPorDefecto(gruposLatte);
    sel = alternarOpcion(tamano, sel, 'mediano');
    expect(sel.tamano).toEqual(['mediano']);
    expect(alternarOpcion(tamano, sel, 'mediano').tamano).toEqual(['mediano']);
  });
  test('una opción opcional se quita al tocarla otra vez', () => {
    let sel = alternarOpcion(shot, {}, 'un-shot');
    expect(sel['extra-shot']).toEqual(['un-shot']);
    sel = alternarOpcion(shot, sel, 'un-shot');
    expect(sel['extra-shot']).toEqual([]);
  });
  test('opción no disponible no se elige', () => {
    const g = { ...leche, opciones: leche.opciones.map((o) => ({ ...o, disponible: o.id !== 'coco' })) };
    const sel = { leche: ['entera'] };
    expect(alternarOpcion(g, sel, 'coco')).toBe(sel);
  });
});

describe('caso J', () => {
  test('Latte grande, avena, 1 shot, vainilla y caramelo = $130; tercer jarabe no se permite', () => {
    let sel = seleccionPorDefecto(gruposLatte);
    sel = alternarOpcion(tamano, sel, 'grande');
    sel = alternarOpcion(leche, sel, 'avena');
    sel = alternarOpcion(shot, sel, 'un-shot');
    sel = alternarOpcion(jarabes, sel, 'vainilla');
    sel = alternarOpcion(jarabes, sel, 'caramelo');
    expect(puedeAgregarOpcion(jarabes, sel)).toBe(false);
    const conTercero = alternarOpcion(jarabes, sel, 'avellana');
    expect(conTercero).toBe(sel);
    expect(sel.jarabes).toEqual(['vainilla', 'caramelo']);

    expect(validarSeleccion(gruposLatte, sel)).toEqual([]);
    const mods = modificadoresElegidos(gruposLatte, sel);
    expect(precioUnitario(latte.precio, mods)).toBe(13000);
    expect(resumenModificadores(mods)).toBe('Grande 20 oz, Avena, 1 shot extra, Vainilla, Caramelo');
  });
  test('una selección con tres jarabes es inválida', () => {
    const sel = { ...seleccionPorDefecto(gruposLatte), jarabes: ['vainilla', 'caramelo', 'avellana'] };
    expect(validarSeleccion(gruposLatte, sel)).toEqual([
      { grupoId: 'jarabes', mensaje: 'Elige máximo 2 en Jarabes' },
    ]);
  });
});

describe('validación', () => {
  test('obligatorio sin elegir', () => {
    expect(validarSeleccion([tamano, leche], { tamano: [], leche: ['entera'] })).toEqual([
      { grupoId: 'tamano', mensaje: 'Elige tamaño' },
    ]);
  });
  test('mínimo en grupo de varias opciones', () => {
    const g = { ...jarabes, min: 2 };
    expect(validarSeleccion([g], { jarabes: ['vainilla'] })).toEqual([
      { grupoId: 'jarabes', mensaje: 'Elige al menos 2 en Jarabes' },
    ]);
  });
  test('opción que dejó de existir', () => {
    expect(validarSeleccion([tamano], { tamano: ['jumbo'] })[0]?.grupoId).toBe('tamano');
  });
});

describe('precio y clave', () => {
  test('caso A: Latte mediano con almendra = $85', () => {
    const sel = { ...seleccionPorDefecto(gruposLatte), tamano: ['mediano'], leche: ['almendra'] };
    const mods = modificadoresElegidos(gruposLatte, sel);
    expect(precioUnitario(latte.precio, mods)).toBe(8500);
    expect(resumenModificadores(mods)).toBe('Mediano 16 oz, Almendra');
  });
  test('la clave no depende del orden', () => {
    expect(claveSeleccion({ jarabes: ['caramelo', 'vainilla'], tamano: ['chico'], leche: [] })).toBe(
      claveSeleccion({ tamano: ['chico'], jarabes: ['vainilla', 'caramelo'] }),
    );
  });
});

describe('indicación de cada grupo', () => {
  test('según tipo, obligatorio, mínimo y máximo', () => {
    expect(indicacionGrupo(tamano)).toBe('(elige 1)');
    expect(indicacionGrupo(shot)).toBe('(opcional)');
    expect(indicacionGrupo(jarabes)).toBe('(hasta 2)');
    expect(indicacionGrupo({ ...jarabes, obligatorio: true, min: 1, max: 3 })).toBe('(elige de 1 a 3)');
    expect(indicacionGrupo({ ...jarabes, min: 2, max: 2 })).toBe('(elige 2)');
  });
});
