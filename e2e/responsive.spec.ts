import { expect, test, type Page } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, PIN, prepararDispositivo } from './ayudas';

const TAMANOS = [
  { nombre: 'tablet 1180×820', width: 1180, height: 820, prefijo: 'E' },
  { nombre: 'tablet 1024×768', width: 1024, height: 768, prefijo: 'F' },
  { nombre: 'vertical 800×1280', width: 800, height: 1280, prefijo: 'G' },
  { nombre: 'celular 390×844', width: 390, height: 844, prefijo: 'H' },
];

/** Nada se sale de la pantalla a lo ancho (las tablas pueden desplazarse dentro de su caja). */
const sinDesborde = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <= window.innerWidth &&
      document.body.scrollWidth <= window.innerWidth,
  );

for (const t of TAMANOS) {
  test(`sin desbordes en ${t.nombre}`, async ({ page }) => {
    await page.setViewportSize({ width: t.width, height: t.height });
    await prepararDispositivo(page, t.prefijo, `Caja ${t.prefijo}`);
    await entrarCon(page, PIN.dueno);
    expect(await sinDesborde(page)).toBe(true);
    await irAVentaConCajaAbierta(page);
    await page.getByRole('tab', { name: 'Cafés' }).click();
    await page.getByRole('button', { name: /^Espresso/ }).click();
    await page
      .getByRole('dialog', { name: 'Espresso' })
      .getByRole('button', { name: /^Agregar/ })
      .click();
    expect(await sinDesborde(page)).toBe(true);
    for (const ruta of ['Inicio', 'Ventas', 'Caja']) {
      await page
        .getByRole('navigation', { name: 'Secciones' })
        .filter({ visible: true })
        .getByRole('link', { name: ruta })
        .click();
      await expect(page.getByRole('main')).toBeVisible();
      expect(await sinDesborde(page), ruta).toBe(true);
    }
  });
}
