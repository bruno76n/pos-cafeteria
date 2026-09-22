import { describe, expect, test } from 'vitest';
import { gruposPrueba, grupoPrueba, productoPrueba } from './datosPrueba';
import {
  alternarOpcion,
  claveSeleccion,
  gruposDelProducto,
  indicacionGrupo,
  modificadoresElegidos,
  puedeAgregarOpcion,
  resumenModificadores,
  seleccionPorDefecto,
  validarSeleccion,
} from './modificadores';

const latte = productoPrueba('latte');
const gruposLatte = gruposDelProducto(latte, gruposPrueba);
const leche = grupoPrueba('leche');
const shot = grupoPrueba('extra-shot');
const jarabes = grupoPrueba('jarabes');

describe('selección por defecto', () => {
  test('toma las opciones marcadas por defecto, en el orden del producto', () => {
    expect(gruposLatte.map((g) => g.id)).toEqual(['leche', 'extra-shot', 'jarabes', 'toppings']);
    const sel = seleccionPorDefecto(gruposLatte);
    expect(sel).toEqual({
      leche: ['entera'],
      'extra-shot': [],
      jarabes: [],
      toppings: [],
    });
    expect(validarSeleccion(gruposLatte, sel)).toEqual([]);
  });
  test('ignora opciones por defecto no disponibles', () => {
    const g = { ...leche, opciones: leche.opciones.map((o) => ({ ...o, disponible: o.id !== 'entera' })) };
    expect(seleccionPorDefecto([g])).toEqual({ leche: [] });
    expect(validarSeleccion([g], { leche: [] })).toEqual([{ grupoId: 'leche', mensaje: 'Elige leche' }]);
  });
});

describe('alternar opciones', () => {
  test('una opción reemplaza y no se puede quitar si es obligatoria', () => {
    let sel = seleccionPorDefecto(gruposLatte);
    sel = alternarOpcion(leche, sel, 'almendra');
    expect(sel.leche).toEqual(['almendra']);
    expect(alternarOpcion(leche, sel, 'almendra').leche).toEqual(['almendra']);
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
  test('Latte con avena, 1 shot, vainilla y caramelo; tercer jarabe no se permite', () => {
    let sel = seleccionPorDefecto(gruposLatte);
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
    expect(mods.reduce((s, m) => s + m.precioExtra, 0)).toBe(4500);
    expect(resumenModificadores(mods)).toBe('Avena, 1 shot extra, Vainilla, Caramelo');
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
    expect(validarSeleccion([leche, shot], { leche: [], 'extra-shot': [] })).toEqual([
      { grupoId: 'leche', mensaje: 'Elige leche' },
    ]);
  });
  test('mínimo en grupo de varias opciones', () => {
    const g = { ...jarabes, min: 2 };
    expect(validarSeleccion([g], { jarabes: ['vainilla'] })).toEqual([
      { grupoId: 'jarabes', mensaje: 'Elige al menos 2 en Jarabes' },
    ]);
  });
  test('opción que dejó de existir', () => {
    expect(validarSeleccion([leche], { leche: ['cabra'] })[0]?.grupoId).toBe('leche');
  });
});

describe('clave', () => {
  test('la clave no depende del orden', () => {
    expect(claveSeleccion({ jarabes: ['caramelo', 'vainilla'], leche: ['avena'], toppings: [] })).toBe(
      claveSeleccion({ leche: ['avena'], jarabes: ['vainilla', 'caramelo'] }),
    );
  });
});

describe('indicación de cada grupo', () => {
  test('según tipo, obligatorio, mínimo y máximo', () => {
    expect(indicacionGrupo(leche)).toBe('(elige 1)');
    expect(indicacionGrupo(shot)).toBe('(opcional)');
    expect(indicacionGrupo(jarabes)).toBe('(hasta 2)');
    expect(indicacionGrupo({ ...jarabes, obligatorio: true, min: 1, max: 3 })).toBe('(elige de 1 a 3)');
    expect(indicacionGrupo({ ...jarabes, min: 2, max: 2 })).toBe('(elige 2)');
  });
});
