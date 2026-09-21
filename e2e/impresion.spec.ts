import { expect, test, type Page } from '@playwright/test';
import { entrarCon, irAVentaConCajaAbierta, panelVenta, PIN, prepararDispositivo } from './ayudas';

/** Registra el HTML de cada ticket que se manda a imprimir por el navegador (srcdoc del iframe oculto). */
async function capturarImpresiones(page: Page) {
  await page.addInitScript(() => {
    // El diálogo de impresión real bloquea la página en Chromium sin interfaz: se simula (también en iframes).
    window.print = () => setTimeout(() => window.dispatchEvent(new Event('afterprint')), 0);
    const original = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc')!;
    Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
      ...original,
      set(valor: string) {
        const w = window as unknown as { impresos?: string[] };
        (w.impresos ??= []).push(valor);
        original.set!.call(this, valor);
      },
    });
  });
  return () =>
    page.evaluate(() => ((window as unknown as { impresos?: string[] }).impresos ?? []).join('\n'));
}

test('imprimir ticket y prueba con el driver del navegador', async ({ page }) => {
  const impresos = await capturarImpresiones(page);
  await prepararDispositivo(page, 'K');
  await entrarCon(page, PIN.dueno);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();

  await panelVenta(page).getByRole('button', { name: 'Imprimir ticket' }).click();
  await expect.poll(impresos).toContain('Folio: K-000001');
  expect(await impresos()).toContain('@page { size: 58mm auto; margin: 0; }');

  await page.getByRole('link', { name: 'Configuración' }).click();
  await page.getByRole('link', { name: 'Dispositivo' }).click();
  await expect(page.getByText('Conexión')).toBeVisible();
  await page.getByRole('button', { name: 'Imprimir prueba' }).click();
  await expect.poll(impresos).toContain('Café, Piña, Año, ¡Gracias!');
});

test('compartir el ticket digital (hoja del sistema o WhatsApp)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { compartidos: string[]; conShare: boolean };
    w.compartidos = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      get: () =>
        w.conShare === false
          ? undefined
          : async (datos: ShareData) => {
              w.compartidos.push(`${datos.title}\n${datos.text}`);
            },
    });
  });
  await prepararDispositivo(page, 'L');
  await entrarCon(page, PIN.cajero);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();

  await panelVenta(page).getByRole('button', { name: 'Compartir' }).click();
  const compartidos = () =>
    page.evaluate(() => (window as unknown as { compartidos: string[] }).compartidos.join('\n'));
  await expect.poll(compartidos).toContain('Ticket L-000001');
  expect(await compartidos()).toContain('1 Brownie                 $45.00');

  // Sin hoja de compartir: copiar o WhatsApp
  await page.evaluate(() => ((window as unknown as { conShare: boolean }).conShare = false));
  await panelVenta(page).getByRole('button', { name: 'Compartir' }).click();
  const whatsapp = page
    .getByRole('dialog', { name: 'Compartir ticket' })
    .getByRole('link', { name: 'Abrir WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=.*L-000001/);
});
