import { describe, expect, test, vi } from 'vitest';
import { CONFIG_IMPRESORA_POR_DEFECTO } from '../configImpresora';
import type { TicketDocumento } from '../ticket';
import { base64, crearDriverRawBT, urlRawBT } from './rawbt';
import { MENSAJES_IMPRESORA as M } from './tipos';

const doc: TicketDocumento = { columnas: 32, lineas: [{ tipo: 'texto', texto: 'Hola' }] };
const bytes = Uint8Array.from([0x1b, 0x40, 0x43, 0x61, 0x66, 0x82, 0x0a]);
const config = { ...CONFIG_IMPRESORA_POR_DEFECTO, tipo: 'rawbt' as const };

describe('driver RawBT', () => {
  test('manda los bytes ESC/POS en base64 al esquema de RawBT', async () => {
    const abrir = vi.fn(async () => true);
    const driver = crearDriverRawBT({ soportado: () => true, abrir, bytes: async () => bytes });
    await driver.imprimir(doc, config);
    expect(abrir).toHaveBeenCalledWith('intent:base64,G0BDYWaCCg==#Intent;scheme=rawbt;end;');
    expect(urlRawBT(bytes)).toBe('intent:base64,G0BDYWaCCg==#Intent;scheme=rawbt;end;');
  });

  test('si RawBT no responde (no está instalada), error claro', async () => {
    const driver = crearDriverRawBT({
      soportado: () => true,
      abrir: async () => false,
      bytes: async () => bytes,
    });
    await expect(driver.imprimir(doc, config)).rejects.toThrow(M.rawbt);
  });

  test('siempre lista: no hay que buscar impresora', async () => {
    const driver = crearDriverRawBT({ soportado: () => false, abrir: vi.fn(), bytes: async () => bytes });
    expect(driver.soportado()).toBe(false);
    expect(driver.estado()).toBe('conectada');
    expect(await driver.conectar()).toBeNull();
  });

  test('base64 de tickets grandes (logo) sin desbordar la pila', () => {
    const grande = new Uint8Array(200_000).fill(0xff);
    expect(atob(base64(grande))).toHaveLength(200_000);
  });
});
