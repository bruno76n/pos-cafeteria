import { expect, type Page } from '@playwright/test';

export const PIN = { dueno: '1234', encargada: '2222', cajero: '1111' } as const;

/** Inicia sesión con la cuenta demo y configura el dispositivo con la letra indicada. */
export async function prepararDispositivo(page: Page, prefijo: string, nombre = `Caja ${prefijo}`) {
  await page.goto('/acceso');
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByRole('button', { name: new RegExp(`^${prefijo}( |$)`) }).click();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page).toHaveURL(/\/bloqueo$/);
}

/** Escribe el PIN tocando el teclado propio. */
export async function escribirPin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}

export async function entrarCon(page: Page, pin: string) {
  await expect(page.getByRole('heading', { name: 'Escribe tu PIN' })).toBeVisible();
  await escribirPin(page, pin);
  await expect(page.getByRole('heading', { name: 'Escribe tu PIN' })).toBeHidden();
}
