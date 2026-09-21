import { afterEach, expect, test, vi } from 'vitest';
import { solicitarAlmacenamientoPersistente } from './almacenamiento';
import { leerMeta } from './bd';

afterEach(() => vi.unstubAllGlobals());

test('pide almacenamiento persistente y guarda el resultado', async () => {
  const persist = vi.fn(async () => true);
  vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } });
  expect(await solicitarAlmacenamientoPersistente()).toBe(true);
  expect(persist).toHaveBeenCalledOnce();
  expect(await leerMeta('almacenamientoPersistente')).toBe(true);
});

test('sin la API queda como no persistente', async () => {
  vi.stubGlobal('navigator', {});
  expect(await solicitarAlmacenamientoPersistente()).toBe(false);
  expect(await leerMeta('almacenamientoPersistente')).toBe(false);
});
