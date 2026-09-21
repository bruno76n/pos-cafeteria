import { expect, test } from 'vitest';

test('el servidor corre sin DOM', () => {
  expect(typeof document).toBe('undefined');
});
