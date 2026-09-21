import { describe, expect, test } from 'vitest';
import {
  buscarUsuarioPorPin,
  crearPin,
  esPinValido,
  generarSal,
  hashPin,
  pinEnUso,
  verificarPin,
} from './pin';

describe('PIN', () => {
  test('formato de 4 a 6 dígitos', () => {
    expect(esPinValido('1234')).toBe(true);
    expect(esPinValido('123456')).toBe(true);
    expect(esPinValido('123')).toBe(false);
    expect(esPinValido('1234567')).toBe(false);
    expect(esPinValido('12a4')).toBe(false);
  });

  test('hash SHA-256(sal:pin) en hexadecimal', async () => {
    // echo -n "abc:1234" | shasum -a 256
    expect(await hashPin('1234', 'abc')).toBe(
      '1755a2d5b309d75bede226f2b6cf858bb14287b917e76ad3b943de0dda4683fb',
    );
    expect(await hashPin('1234', 'abc')).not.toBe(await hashPin('1234', 'abd'));
    expect(generarSal()).toMatch(/^[0-9a-f]{32}$/);
    expect(generarSal()).not.toBe(generarSal());
  });

  test('crear y verificar', async () => {
    const u = await crearPin('2222');
    expect(await verificarPin('2222', u)).toBe(true);
    expect(await verificarPin('2223', u)).toBe(false);
  });

  test('el PIN identifica al usuario activo', async () => {
    const usuarios = [
      { id: 'a', activo: true, ...(await crearPin('1234')) },
      { id: 'b', activo: true, ...(await crearPin('1111')) },
      { id: 'c', activo: false, ...(await crearPin('9999')) },
    ];
    expect((await buscarUsuarioPorPin(usuarios, '1111'))?.id).toBe('b');
    expect(await buscarUsuarioPorPin(usuarios, '9999')).toBeUndefined();
    expect(await buscarUsuarioPorPin(usuarios, '0000')).toBeUndefined();
    expect(await pinEnUso(usuarios, '1111')).toBe(true);
    expect(await pinEnUso(usuarios, '1111', 'b')).toBe(false);
    expect(await pinEnUso(usuarios, '9999')).toBe(true);
  });
});
