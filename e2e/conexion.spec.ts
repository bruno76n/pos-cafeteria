import { expect, test } from '@playwright/test';
import { entrarCon, PIN, prepararDispositivo } from './ayudas';

test('el indicador avisa cuando no hay conexión', async ({ page, context }) => {
  await prepararDispositivo(page, 'Q');
  await entrarCon(page, PIN.dueno);
  await expect(page.getByRole('status').filter({ hasText: 'En línea' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible();
  await expect(
    page.getByText('Sin conexión. Las ventas se guardan en esta tablet y se suben solas.'),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'En línea' })).toBeVisible();
});
