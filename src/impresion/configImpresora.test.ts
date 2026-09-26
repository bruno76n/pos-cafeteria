import { expect, test } from 'vitest';
import {
  CONFIG_IMPRESORA_POR_DEFECTO,
  columnasDeImpresora,
  normalizarConfigImpresora,
} from './configImpresora';

test('por defecto: sistema, 58 mm, 3 líneas de avance, sin corte, 1 copia', () => {
  expect(normalizarConfigImpresora(null)).toEqual(CONFIG_IMPRESORA_POR_DEFECTO);
  expect(CONFIG_IMPRESORA_POR_DEFECTO).toMatchObject({
    tipo: 'sistema',
    ancho: 58,
    avance: 3,
    cortar: false,
    copias: 1,
  });
  expect(columnasDeImpresora(CONFIG_IMPRESORA_POR_DEFECTO)).toBe(32);
  expect(columnasDeImpresora({ ancho: 80 })).toBe(48);
});

test('valores inválidos vuelven al valor por defecto sin perder los demás', () => {
  expect(normalizarConfigImpresora({ tipo: 'rawbt', avance: 99, copias: 0, ancho: 80 })).toEqual({
    ...CONFIG_IMPRESORA_POR_DEFECTO,
    tipo: 'rawbt',
    ancho: 80,
  });
});

test('la configuración de la versión anterior se convierte', () => {
  expect(normalizarConfigImpresora({ tipo: 'usb', reconexion: { serialNumber: 'S1' } }).tipo).toBe('sistema');
  expect(normalizarConfigImpresora({ tipo: 'navegador', reconexion: null }).tipo).toBe('sistema');
  expect(
    normalizarConfigImpresora({
      tipo: 'bluetooth',
      reconexion: { id: 'BT-1', nombre: 'MPT-II', language: 'esc-pos' },
    }),
  ).toMatchObject({ tipo: 'bluetooth', dispositivo: { id: 'BT-1', nombre: 'MPT-II' } });
});
