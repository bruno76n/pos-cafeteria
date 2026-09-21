import { expect, test, type Page } from '@playwright/test';
import {
  entrarCon,
  escribirPin,
  irAVentaConCajaAbierta,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

async function mantenerPresionado(page: Page, nombre: RegExp) {
  await page.getByRole('button', { name: nombre }).hover({ force: true });
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
}

test('pulsación larga marca un producto como no disponible (con permiso o autorización)', async ({
  page,
}) => {
  await prepararDispositivo(page, 'D', 'Caja disponibilidad');
  await entrarCon(page, PIN.encargada);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();

  await mantenerPresionado(page, /^Galleta de chispas/);
  await page
    .getByRole('dialog', { name: '¿Marcar Galleta de chispas como no disponible?' })
    .getByRole('button', { name: 'Marcar no disponible' })
    .click();
  const galleta = page.getByRole('button', { name: /^Galleta de chispas/ });
  await expect(galleta).toContainText('No disponible');
  await expect(galleta).toHaveAttribute('aria-disabled', 'true');
  await galleta.click({ force: true }); // tocarlo no agrega nada
  await expect(panelVenta(page)).not.toContainText('Galleta');

  // El cajero necesita autorización para volver a activarla
  await page.getByRole('button', { name: 'Encargada' }).click();
  await page.getByRole('menuitem', { name: 'Cambiar usuario' }).click();
  await entrarCon(page, PIN.cajero);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await mantenerPresionado(page, /^Galleta de chispas/);
  await page
    .getByRole('dialog', { name: '¿Marcar Galleta de chispas como disponible?' })
    .getByRole('button', { name: 'Marcar disponible' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Pedir autorización' })).toContainText('editar el menú');
  await escribirPin(page, PIN.encargada);
  await expect(galleta).toContainText('$30.00');
  await galleta.click();
  await expect(panelVenta(page)).toContainText('Galleta de chispas');
});
