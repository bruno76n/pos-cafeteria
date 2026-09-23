import { expect, test } from 'vitest';
import { aCSV, pesosCSV } from './csv.js';

test('CSV con BOM, escapado y CRLF', () => {
  const csv = aCSV(
    ['Producto', 'Importe'],
    [
      ['Café "de olla", grande', pesosCSV(19350)],
      ['Piña', null],
    ],
  );
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toBe('﻿Producto,Importe\r\n"Café ""de olla"", grande",193.50\r\nPiña,\r\n');
  expect(pesosCSV(5)).toBe('0.05');
});
