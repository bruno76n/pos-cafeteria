import { expect, test, type Page } from '@playwright/test';
import {
  entrarCon,
  irAVentaConCajaAbierta,
  leerServidor,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

const cobrarExacto = async (page: Page) => {
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobro = page.getByRole('dialog', { name: 'Cobro' });
  await cobro.getByRole('button', { name: 'Exacto' }).click();
  await cobro.getByRole('button', { name: 'Confirmar cobro' }).click();
};

const irAMenu = (page: Page) =>
  page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Menú' }).click();

test('crear ingredientes y una crepa con dos tamaños, y venderla con 4 ingredientes', async ({
  page,
  request,
}) => {
  await prepararDispositivo(page, 'Q', 'Caja crepas');
  await entrarCon(page, PIN.dueno);

  // Ingredientes con alta rápida (Enter agrega y deja listo el siguiente)
  await irAMenu(page);
  await page.getByRole('link', { name: 'Ingredientes' }).click();
  await page.getByLabel('Grupo (opcional)').fill('Frutas');
  for (const nombre of ['Mango', 'Kiwi', 'Guayaba', 'Maracuyá', 'Tamarindo']) {
    await page.getByLabel('Nuevo ingrediente').fill(nombre);
    await page.getByLabel('Nuevo ingrediente').press('Enter');
    await expect(page.getByRole('listitem').filter({ hasText: nombre })).toContainText('Frutas');
  }
  await page.getByRole('switch', { name: 'Tamarindo disponible' }).click();

  // Crepa con dos tamaños que se arma con ingredientes
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.getByRole('link', { name: 'Agregar producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Crepa tropical');
  await page.getByRole('button', { name: 'Crepas', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar tamaño' }).click();
  await page.getByLabel('Nombre del tamaño 1').fill('Chica');
  await page.getByLabel('Precio del tamaño 1').fill('55');
  await page.getByRole('button', { name: 'Agregar tamaño' }).click();
  await page.getByLabel('Nombre del tamaño 2').fill('Grande');
  await page.getByLabel('Precio del tamaño 2').fill('75');
  await expect(page.getByLabel('Precio', { exact: true })).toBeHidden();
  await page.getByRole('switch', { name: 'Se arma con ingredientes' }).click();
  await page.getByLabel('Incluidos en Chica').fill('2');
  await page.getByLabel('Incluidos en Grande').fill('2');
  await page.getByLabel('Precio por ingrediente extra').fill('5');
  await page.getByLabel('Máximo').fill('5');
  await page.getByRole('button', { name: 'Elegir', exact: true }).click();
  await page.getByRole('button', { name: 'Frutas', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar todos' }).click();
  await expect(page.getByText('5 permitidos')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Vista previa' })).toContainText('Desde $55.00');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Crepa tropical' })).toContainText(
    'Desde $55.00',
  );

  // Venta: Grande con 4 ingredientes = $75 + 2 × $5
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Crepas' }).click();
  await expect(page.getByRole('button', { name: /^Crepa tropical/ })).toContainText('Desde $55.00');
  await page.getByRole('button', { name: /^Crepa tropical/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Crepa tropical' });
  const accion = hoja.getByRole('button', { name: /^(Agregar|Elige)/ });
  await expect(hoja.getByRole('button', { name: /^Chica/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(accion).toHaveText('Elige al menos 1 ingrediente');
  await expect(accion).toBeDisabled();
  await hoja.getByRole('button', { name: /^Grande/ }).click();
  await expect(hoja).toContainText('Incluye 2. Cada extra +$5.00. Máximo 5');
  await expect(hoja.getByRole('button', { name: 'Tamarindo' })).toBeDisabled();
  for (const nombre of ['Mango', 'Kiwi', 'Guayaba']) await hoja.getByRole('button', { name: nombre }).click();
  await expect(hoja).toContainText('3 elegidos: 1 extra');
  await hoja.getByRole('button', { name: 'Maracuyá' }).click();
  await expect(hoja).toContainText('4 elegidos: 2 extra');
  await expect(accion).toHaveText('Agregar $85.00');
  await accion.click();

  const panel = panelVenta(page);
  await expect(panel).toContainText('Crepa tropical Grande');
  await expect(panel).toContainText('Mango, Kiwi, Guayaba, Maracuyá (2 extra)');

  // La misma crepa otra vez (ingredientes en otro orden) se suma a la misma línea
  await page.getByRole('button', { name: /^Crepa tropical/ }).click();
  await hoja.getByRole('button', { name: /^Grande/ }).click();
  for (const nombre of ['Maracuyá', 'Guayaba', 'Kiwi', 'Mango']) {
    await hoja.getByRole('button', { name: nombre }).click();
  }
  await hoja.getByRole('button', { name: /^Agregar/ }).click();
  await expect(panel.getByRole('button', { name: /Cobrar/ })).toHaveText('Cobrar$170.00');
  await expect(panel.getByRole('listitem')).toHaveCount(1);
  await expect(panel).toContainText('2 × $85.00');

  await cobrarExacto(page);
  await expect(panel.getByRole('status')).toContainText('Venta Q-000001');
  await expect
    .poll(async () => (await leerServidor(request))('ventas').find((v) => v.folio === 'Q-000001')?.lineas, {
      timeout: 15_000,
    })
    .toEqual([
      expect.objectContaining({
        nombre: 'Crepa tropical',
        cantidad: 2,
        precioBase: 7500,
        tamano: { nombre: 'Grande', precio: 7500 },
        ingredientes: {
          nombres: ['Mango', 'Kiwi', 'Guayaba', 'Maracuyá'],
          incluidos: 2,
          extras: 2,
          precioExtra: 500,
        },
        precioUnitario: 8500,
        importe: 17000,
      }),
    ]);
});

test('crear una bebida con tamaños y un extra, y venderla', async ({ page, request }) => {
  await prepararDispositivo(page, 'V', 'Caja bebidas');
  await entrarCon(page, PIN.dueno);

  // Extra nuevo
  await irAMenu(page);
  await page.getByRole('link', { name: 'Modificadores' }).click();
  await page.getByRole('button', { name: 'Nuevo grupo' }).click();
  const dialogoGrupo = page.getByRole('dialog', { name: 'Nuevo grupo' });
  await dialogoGrupo.getByLabel('Nombre', { exact: true }).fill('Leche vegetal');
  await dialogoGrupo.getByLabel('Nombre de la opción 1').fill('Almendra');
  await dialogoGrupo.getByLabel('Precio extra de la opción 1').fill('10');
  await dialogoGrupo.getByRole('button', { name: 'Guardar' }).click();

  // Bebida con dos tamaños y el extra asignado
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.getByRole('link', { name: 'Agregar producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Horchata');
  await page.getByRole('button', { name: 'Bebidas frías', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar tamaño' }).click();
  await page.getByLabel('Nombre del tamaño 1').fill('Chico');
  await page.getByLabel('Precio del tamaño 1').fill('65');
  await page.getByRole('button', { name: 'Agregar tamaño' }).click();
  await page.getByLabel('Nombre del tamaño 2').fill('Mediano');
  await page.getByLabel('Precio del tamaño 2').fill('75');
  await page
    .getByRole('group', { name: 'Opciones adicionales' })
    .getByRole('checkbox', { name: /^Leche vegetal/ })
    .check();
  await page.getByRole('button', { name: 'Guardar' }).click();

  // Venta: Mediano $75 + almendra $10 = $85
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Bebidas frías' }).click();
  await expect(page.getByRole('button', { name: /^Horchata/ })).toContainText('Desde $65.00');
  await page.getByRole('button', { name: /^Horchata/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Horchata' });
  await expect(hoja.getByRole('button', { name: /^Agregar/ })).toHaveText('Agregar $65.00');
  await hoja.getByRole('button', { name: /^Mediano/ }).click();
  await hoja.getByRole('button', { name: /^Almendra/ }).click();
  await expect(hoja.getByRole('button', { name: /^Agregar/ })).toHaveText('Agregar $85.00');
  await hoja.getByRole('button', { name: /^Agregar/ }).click();
  await expect(panelVenta(page)).toContainText('Horchata Mediano');
  await expect(panelVenta(page)).toContainText('Almendra');
  await cobrarExacto(page);
  await expect(panelVenta(page).getByRole('status')).toContainText('Venta V-000001');
  await expect
    .poll(async () => (await leerServidor(request))('ventas').find((v) => v.folio === 'V-000001')?.lineas, {
      timeout: 15_000,
    })
    .toEqual([
      expect.objectContaining({
        nombre: 'Horchata',
        tamano: { nombre: 'Mediano', precio: 7500 },
        modificadores: [{ grupo: 'Leche vegetal', opcion: 'Almendra', precioExtra: 1000 }],
        precioUnitario: 8500,
      }),
    ]);
});
