import { expect, test } from 'vitest';

test('la app corre con DOM', () => {
  expect(typeof document).toBe('object');
});
