import { expect, test, type Page } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, PIN, prepararDispositivo } from './ayudas';

const cambiarUsuario = async (page: Page, actual: string, pin: string) => {
  await page.getByRole('button', { name: actual, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Cambiar usuario' }).click();
  await entrarCon(page, pin);
};

test('usuarios: crear con PIN único y proteger al último Administrador', async ({ page }) => {
  await prepararDispositivo(page, 'U');
  await entrarCon(page, PIN.dueno);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Usuarios' }).click();

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nuevo usuario' });
  await dialogo.getByLabel('Nombre').fill('Beto');
  await dialogo.getByLabel('PIN (4 a 6 números)').fill('1111');
  await dialogo.getByLabel('Confirma el PIN').fill('1111');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('Ese PIN ya lo usa otro usuario. Elige otro.');
  await dialogo.getByLabel('PIN (4 a 6 números)').fill('3456');
  await dialogo.getByLabel('Confirma el PIN').fill('3456');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Beto' })).toContainText('Cajero');

  // El último Administrador no se desactiva
  await page.getByRole('button', { name: 'Editar Dueño' }).click();
  const editar = page.getByRole('dialog', { name: 'Editar Dueño' });
  await editar.getByRole('switch', { name: 'Activo' }).click();
  await editar.getByRole('button', { name: 'Guardar' }).click();
  await expect(editar.getByRole('alert')).toContainText('último Administrador');
  await editar.getByRole('button', { name: 'Cerrar' }).click();

  // Beto entra con su PIN
  await cambiarUsuario(page, 'Dueño', '3456');
  await expect(page.getByRole('banner')).toContainText('Beto');
});

test('quitar un permiso al cajero hace que pida autorización', async ({ page }) => {
  await prepararDispositivo(page, 'V');
  await entrarCon(page, PIN.dueno);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Usuarios' }).click();
  await page.getByRole('link', { name: 'Roles y permisos' }).click();
  const permiso = page.getByRole('switch', { name: 'Registrar gastos y movimientos de caja (Cajero)' });
  await expect(permiso).toHaveAttribute('aria-checked', 'true');
  await permiso.click();
  await expect(permiso).toHaveAttribute('aria-checked', 'false');

  await cambiarUsuario(page, 'Dueño', PIN.cajero);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Caja' }).click();
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  await page.getByRole('dialog', { name: 'Registrar gasto' }).getByLabel('Concepto').fill('Hielo');
  await page.getByRole('dialog', { name: 'Registrar gasto' }).getByLabel('Monto').fill('20');
  await page
    .getByRole('dialog', { name: 'Registrar gasto' })
    .getByRole('button', { name: 'Registrar gasto' })
    .click();
  const autorizacion = page.getByRole('dialog', { name: 'Pedir autorización' });
  await expect(autorizacion).toContainText('registrar movimientos de caja');
  // En Caja también está el teclado del conteo: el PIN se escribe en el del diálogo
  for (const d of PIN.encargada) await autorizacion.getByRole('button', { name: d, exact: true }).click();
  await expect(autorizacion).toBeHidden();
  await expect(page.getByText('Gastos').locator('..')).toContainText('$20.00');

  // Se deja el permiso como estaba
  await cambiarUsuario(page, 'Cajero', PIN.dueno);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Usuarios' }).click();
  await page.getByRole('link', { name: 'Roles y permisos' }).click();
  await permiso.click();
  await expect(permiso).toHaveAttribute('aria-checked', 'true');
});
