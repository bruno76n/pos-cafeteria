import { expect, test } from '@playwright/test';
import { entrarCon, PIN, prepararDispositivo } from './ayudas';

test('entra con la cuenta demo y la sesión sobrevive a recargar sin API', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/acceso$/);
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('mala');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');

  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dispositivo$/);

  await page.route('**/api/**', (ruta) => ruta.abort());
  await page.reload();
  await expect(page).toHaveURL(/\/dispositivo$/);
  await page.unroute('**/api/**');

  await page.getByLabel('Nombre').fill('Caja 1');
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page).toHaveURL(/\/bloqueo$/);

  // El PIN identifica al usuario; recargar vuelve a pedirlo.
  await entrarCon(page, PIN.dueno);
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('banner')).toContainText('Dueño');
  await page.reload();
  await expect(page).toHaveURL(/\/bloqueo$/);
});

test('primer inicio sin internet', async ({ page }) => {
  await page.goto('/acceso');
  await page.route('**/api/**', (ruta) => ruta.abort());
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Necesitas internet para el primer inicio de sesión en este dispositivo.',
  );
});

test('cambio de usuario: el cajero no ve Reportes ni Configuración', async ({ page }) => {
  await prepararDispositivo(page, 'B');
  await entrarCon(page, PIN.dueno);
  const secciones = page.getByRole('navigation', { name: 'Secciones' });
  await expect(secciones.getByRole('link', { name: 'Reportes' })).toBeVisible();
  await expect(secciones.getByRole('link', { name: 'Configuración' })).toBeVisible();

  await page.getByRole('button', { name: 'Dueño' }).click();
  await page.getByRole('menuitem', { name: 'Cambiar usuario' }).click();
  await entrarCon(page, PIN.cajero);
  await expect(page.getByRole('banner')).toContainText('Cajero');
  await expect(secciones.getByRole('link', { name: 'Venta', exact: true })).toBeVisible();
  await expect(secciones.getByRole('link', { name: 'Caja' })).toBeVisible();
  await expect(secciones.getByRole('link', { name: 'Reportes' })).toHaveCount(0);
  await expect(secciones.getByRole('link', { name: 'Configuración' })).toHaveCount(0);
  await expect(secciones.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);

  await page.goto('/reportes');
  await entrarCon(page, PIN.cajero);
  await expect(page.getByText('Tu usuario no puede ver reportes.')).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar usuario' }).click();
  await entrarCon(page, PIN.encargada);
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();

  await page.getByRole('button', { name: 'Encargada' }).click();
  await page.getByRole('menuitem', { name: 'Bloquear' }).click();
  await expect(page).toHaveURL(/\/bloqueo$/);
});
