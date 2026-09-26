import { expect, test, type Page } from '@playwright/test';
import {
  capturarTrabajos,
  entrarCon,
  irAVentaConCajaAbierta,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

const capturarImpresiones = async (page: Page) => {
  const trabajos = await capturarTrabajos(page);
  return async () => (await trabajos()).join('\n');
};

async function irAImpresora(page: Page) {
  await page.getByRole('link', { name: 'Configuración' }).click();
  await page.getByRole('link', { name: 'Impresora' }).click();
  await expect(page.getByRole('heading', { name: 'Impresora', level: 1 })).toBeVisible();
}

const elegido = (page: Page, grupo: string, opcion: string) =>
  expect(page.getByRole('group', { name: grupo }).getByRole('button', { name: opcion })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

test('impresora del sistema: se configura, persiste al recargar e imprime al cobrar', async ({ page }) => {
  const impresos = await capturarImpresiones(page);
  await prepararDispositivo(page, 'K');
  await entrarCon(page, PIN.dueno);
  await irAImpresora(page);
  await elegido(page, 'Ancho de papel', '58 mm (32 columnas)');
  await page.getByRole('button', { name: '80 mm (48 columnas)' }).click();
  await page.getByRole('switch', { name: 'Imprimir automáticamente al cobrar' }).click();
  // Se guarda al instante en la base local: se espera a verlo antes de recargar.
  await expect(page.getByRole('switch', { name: 'Imprimir automáticamente al cobrar' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await elegido(page, 'Ancho de papel', '80 mm (48 columnas)');

  await page.reload();
  await entrarCon(page, PIN.dueno);
  await irAImpresora(page);
  await elegido(page, 'Ancho de papel', '80 mm (48 columnas)');
  await expect(page.getByRole('switch', { name: 'Imprimir automáticamente al cobrar' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.getByRole('button', { name: 'Imprimir prueba' }).click();
  await expect.poll(impresos).toContain('Café, Piña, Año, ¡Gracias!');
  expect(await impresos()).toContain('$1,234.50');
  expect(await impresos()).toContain('@page { size: 80mm auto; margin: 0; }');

  // Al cobrar se imprime solo; el botón vuelve a imprimir.
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await page.getByRole('button', { name: /^Brownie/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect.poll(impresos).toContain('Folio: K-000001');
  await expect(panelVenta(page).getByRole('button', { name: 'Imprimir ticket' })).toBeVisible();
});

test('impresora Bluetooth: buscar, errores claros, imprimir en trozos y olvidar', async ({ page }) => {
  // Web Bluetooth simulado: la primera búsqueda no encuentra nada; la segunda, la 58-LL.
  await page.addInitScript(() => {
    const w = window as unknown as { escritos: number[][]; busquedas: number };
    w.escritos = [];
    w.busquedas = 0;
    const caracteristica = {
      uuid: '0000ff02-0000-1000-8000-00805f9b34fb',
      properties: { write: true, writeWithoutResponse: true },
      writeValueWithoutResponse: async (datos: Uint8Array) => {
        w.escritos.push(Array.from(datos));
      },
      writeValue: async () => {},
    };
    const servidor = {
      connected: false,
      connect: async () => ((servidor.connected = true), servidor),
      disconnect: () => (servidor.connected = false),
      getPrimaryServices: async () => [
        { uuid: '0000ff00-0000-1000-8000-00805f9b34fb', getCharacteristics: async () => [caracteristica] },
      ],
    };
    const dispositivo = Object.assign(new EventTarget(), {
      id: 'BT-58LL',
      name: '58-LL thermal printer',
      gatt: servidor,
      forget: async () => {},
    });
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: {
        requestDevice: async () => {
          if (w.busquedas++ === 0)
            throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError');
          return dispositivo;
        },
        getDevices: async () => [dispositivo],
      },
    });
  });
  await prepararDispositivo(page, 'K');
  await entrarCon(page, PIN.dueno);
  await irAImpresora(page);
  await page.getByRole('button', { name: 'Bluetooth', exact: true }).click();
  await expect(page.getByText('Sin impresora elegida')).toBeVisible();

  await page.getByRole('button', { name: 'Buscar impresora' }).click();
  await expect(
    page.getByText('No se encontró la impresora. Revisa que esté encendida y cerca.'),
  ).toBeVisible();
  await expect(page.getByText('Cambia el tipo de conexión a RawBT.')).toBeVisible();

  await page.getByRole('button', { name: 'Buscar impresora' }).click();
  await expect(page.getByText('Impresora conectada')).toBeVisible();
  await expect(page.getByText('58-LL thermal printer')).toBeVisible();
  await expect(page.getByText('Conectada', { exact: true })).toBeVisible();

  await page
    .getByRole('group', { name: 'Líneas de avance al final' })
    .getByRole('button', { name: '5' })
    .click();
  await page.getByRole('switch', { name: 'Cortar papel al final' }).click();
  await expect(page.getByRole('switch', { name: 'Cortar papel al final' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await elegido(page, 'Líneas de avance al final', '5');
  await page.reload();
  await entrarCon(page, PIN.dueno);
  await irAImpresora(page);
  await elegido(page, 'Tipo de conexión', 'Bluetooth');
  await elegido(page, 'Líneas de avance al final', '5');
  await elegido(page, 'Copias', '1');
  await expect(page.getByRole('switch', { name: 'Cortar papel al final' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // Al abrir la app reconectó sola con el id guardado.
  await expect(page.getByText('Conectada', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Imprimir prueba' }).click();
  await expect(page.getByText('Prueba enviada a la impresora.')).toBeVisible();
  const escritos = await page.evaluate(() => (window as unknown as { escritos: number[][] }).escritos);
  expect(escritos.every((t) => t.length <= 20)).toBe(true);
  const bytes = escritos.flat();
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  expect(hex).toContain('43 61 66 82 2c'); // "Café," en CP437
  expect(hex).toContain('0a 0d 0a 0d 0a 0d 0a 0d 0a 0d 1d 56 01'); // 5 de avance y corte

  await page.getByRole('button', { name: 'Olvidar impresora' }).click();
  await expect(page.getByText('Sin impresora elegida')).toBeVisible();
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
