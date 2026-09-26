import { expect, test, type Page } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, PIN, prepararDispositivo } from './ayudas';

/** Controles sin nombre accesible (campos sin etiqueta, botones sin texto ni aria-label). */
const sinNombre = (page: Page) =>
  page.evaluate(() => {
    const nombre = (el: Element) =>
      (
        el.getAttribute('aria-label') ||
        (el.getAttribute('aria-labelledby') &&
          document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent) ||
        ('labels' in el && (el as HTMLInputElement).labels?.length ? 'etiqueta' : '') ||
        (el.matches('button, a') ? el.textContent : '') ||
        ''
      ).trim();
    return [...document.querySelectorAll('input:not([type=hidden]), select, textarea, button, a[href]')]
      .filter((el) => (el as HTMLElement).offsetParent !== null && !nombre(el))
      .map((el) => el.outerHTML.slice(0, 120));
  });

test('todas las pantallas: controles con nombre y foco visible', async ({ page }) => {
  await prepararDispositivo(page, 'I', 'Caja accesible');
  await entrarCon(page, PIN.dueno);
  await irAVentaConCajaAbierta(page);
  expect(await sinNombre(page)).toEqual([]);

  const rutas: [string, string?][] = [
    ['Inicio'],
    ['Ventas'],
    ['Ventas', 'Devoluciones'],
    ['Menú', 'Productos'],
    ['Menú', 'Categorías'],
    ['Menú', 'Modificadores'],
    ['Caja'],
    ['Caja', 'Movimientos'],
    ['Caja', 'Cortes de caja'],
    ['Reportes'],
    ['Usuarios'],
    ['Usuarios', 'Roles y permisos'],
    ['Configuración', 'Negocio'],
    ['Configuración', 'Impuestos'],
    ['Configuración', 'Pagos'],
    ['Configuración', 'Ticket'],
    ['Configuración', 'Impresora'],
    ['Configuración', 'Dispositivo'],
  ];
  for (const [seccion, pestana] of rutas) {
    await page
      .getByRole('navigation', { name: 'Secciones', exact: true })
      .getByRole('link', { name: seccion, exact: true })
      .click();
    if (pestana) await page.getByRole('link', { name: pestana, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await sinNombre(page), `${seccion} ${pestana ?? ''}`).toEqual([]);
  }

  // Foco visible con teclado: anillo de 3 px
  await page.keyboard.press('Tab');
  const anillo = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth);
  expect(anillo).toBe('3px');
});
