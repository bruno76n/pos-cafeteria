import { expect, test } from '@playwright/test';
import {
  entrarCon,
  escribirPin,
  irAVentaConCajaAbierta,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

test('el cajero necesita autorización para descontar; la encargada no', async ({ page }) => {
  await prepararDispositivo(page, 'D');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();

  await panelVenta(page).getByRole('button', { name: 'Descuento' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Descuento' });
  await dialogo.getByLabel('Porcentaje').fill('60');
  await dialogo.getByRole('button', { name: /^Aplicar/ }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('El descuento máximo es 50 %.');

  await dialogo.getByRole('button', { name: '10%' }).click();
  await dialogo.getByRole('button', { name: /^Aplicar/ }).click();
  const autorizacion = page.getByRole('dialog', { name: 'Pedir autorización' });
  await expect(autorizacion).toContainText('aplicar descuentos');
  await escribirPin(page, PIN.cajero);
  await expect(autorizacion.getByRole('alert')).toHaveText('Cajero tampoco puede aplicar descuentos.');
  await escribirPin(page, PIN.encargada);
  await expect(autorizacion).toBeHidden();
  await expect(panelVenta(page)).toContainText('Descuento 10%');
  await expect(panelVenta(page)).toContainText('−$4.50');
  await expect(panelVenta(page).getByRole('button', { name: /Cobrar/ })).toContainText('$40.50');

  // La encargada aplica sin pedir autorización
  await page.getByRole('button', { name: 'Cajero' }).click();
  await page.getByRole('menuitem', { name: 'Cambiar usuario' }).click();
  await entrarCon(page, PIN.encargada);
  await panelVenta(page).getByRole('button', { name: 'Descuento' }).click();
  await dialogo.getByRole('button', { name: 'Monto' }).click();
  await dialogo.getByLabel('Monto').fill('5');
  await dialogo.getByRole('button', { name: /^Aplicar/ }).click();
  await expect(page.getByRole('dialog', { name: 'Pedir autorización' })).toBeHidden();
  await expect(panelVenta(page).getByRole('button', { name: /Cobrar/ })).toContainText('$40.00');
});
