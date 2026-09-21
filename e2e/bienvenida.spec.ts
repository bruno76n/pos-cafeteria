import { expect, test } from '@playwright/test';

// Base vacía simulada: el servidor no tiene configuración ni menú y lo que se sube no sale de la tablet.
test('asistente inicial con base vacía', async ({ page }) => {
  await page.route('**/api/sync/pull**', (ruta) =>
    ruta.fulfill({ json: { filas: [], rev: 0, hayMas: false } }),
  );
  await page.route('**/api/sync/push', (ruta) => ruta.abort());

  await page.goto('/acceso');
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByLabel('Nombre').fill('Caja 1');
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();

  await expect(page).toHaveURL(/\/bienvenida$/);
  await page.getByLabel('Nombre del negocio').fill('Café Luna');
  await page.getByLabel('Nombre', { exact: true }).fill('Rosa');
  await page.getByLabel('PIN (4 a 6 números)').fill('4321');
  await page.getByLabel('Confirma el PIN').fill('4322');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Los PIN no coinciden.');
  await page.getByLabel('Confirma el PIN').fill('4321');
  await page.getByRole('button', { name: 'Empezar' }).click();

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('banner')).toContainText('Café Luna');
  await expect(page.getByRole('banner')).toContainText('Rosa');
});
