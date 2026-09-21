import { expect, test } from '@playwright/test';
import { entrarCon, leerServidor, PIN, prepararDispositivo } from './ayudas';

test('sin caja abierta no se vende; al abrirla el turno llega a la base', async ({ page, request }) => {
  await prepararDispositivo(page, 'C');
  await entrarCon(page, PIN.cajero);
  await page.getByRole('link', { name: 'Venta', exact: true }).click();
  await expect(page.getByText('Abre la caja para empezar a vender.')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir caja' }).click();
  await page.getByLabel('Fondo inicial').fill('500');
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir caja' }).click();
  await expect(page.getByText('Abre la caja para empezar a vender.')).toBeHidden();

  await expect
    .poll(
      async () => (await leerServidor(request))('turnos').filter((t) => t.dispositivoNombre === 'Caja C'),
      {
        timeout: 15_000,
      },
    )
    .toEqual([
      expect.objectContaining({
        estado: 'abierto',
        fondoInicial: 50000,
        abiertoPor: { id: 'cajero', nombre: 'Cajero' },
      }),
    ]);
});
