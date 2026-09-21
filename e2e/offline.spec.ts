import { expect, test } from '@playwright/test';
import {
  entrarCon,
  irAVentaConCajaAbierta,
  leerServidor,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

test('sin red se vende; al volver la conexión la venta llega a la base', async ({
  page,
  context,
  request,
}) => {
  await prepararDispositivo(page, 'A', 'Caja sin red');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page);

  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible();
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Rol de canela/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
  const resultado = panelVenta(page).getByRole('status');
  await expect(resultado).toContainText(/Venta A-\d{6}/);
  const folio = (await resultado.textContent())!.match(/A-\d{6}/)![0];
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión: 1 venta por subir' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Ventas' }).click();
  await expect(page.getByRole('row').filter({ hasText: folio })).toContainText('Por subir');

  await context.setOffline(false);
  await expect(page.getByRole('row').filter({ hasText: folio })).not.toContainText('Por subir', {
    timeout: 20_000,
  });
  await expect
    .poll(async () => (await leerServidor(request))('ventas').some((v) => v.folio === folio), {
      timeout: 15_000,
    })
    .toBe(true);
});

test('lo que vende un dispositivo aparece en el otro', async ({ browser }) => {
  const contextoA = await browser.newContext();
  const contextoB = await browser.newContext();
  const a = await contextoA.newPage();
  const b = await contextoB.newPage();

  await prepararDispositivo(a, 'B', 'Caja uno');
  await prepararDispositivo(b, 'C', 'Caja dos');
  await entrarCon(a, PIN.cajero);
  await entrarCon(b, PIN.encargada);
  await b.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Ventas' }).click();

  await irAVentaConCajaAbierta(a);
  await a.getByRole('tab', { name: 'Postres' }).click();
  await a.getByRole('button', { name: /^Pan de plátano/ }).click();
  await panelVenta(a)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await a.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await a.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
  const folio = (await panelVenta(a).getByRole('status').textContent())!.match(/B-\d{6}/)![0];

  // El otro dispositivo la recibe en su siguiente pull (cada 15 s)
  await expect(b.getByRole('row').filter({ hasText: folio })).toContainText('1 Pan de plátano', {
    timeout: 30_000,
  });

  await contextoA.close();
  await contextoB.close();
});
