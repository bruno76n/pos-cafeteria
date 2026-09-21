import { expect, test } from '@playwright/test';
import { escribirPin, prepararDispositivo } from './ayudas';

test('cinco PIN incorrectos obligan a esperar', async ({ page }) => {
  await prepararDispositivo(page, 'P');
  for (let i = 0; i < 4; i++) {
    await escribirPin(page, '999999');
    await expect(page.getByRole('alert')).toHaveText('PIN incorrecto.');
  }
  await escribirPin(page, '999999');
  await expect(page.getByRole('alert')).toContainText('segundos para intentar de nuevo.');
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled();
});
