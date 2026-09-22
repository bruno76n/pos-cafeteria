import { expect, test } from '@playwright/test';
import {
  entrarCon,
  irAVentaConCajaAbierta,
  leerServidor,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

const PNG_8X8 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YaOBFTEMLQkAdntLARs7+acAAAAASUVORK5CYII=',
  'base64',
);

test('crear categoría, grupo y producto con imagen y venderlo', async ({ page, request }) => {
  await prepararDispositivo(page, 'R');
  await entrarCon(page, PIN.dueno);
  const secciones = page.getByRole('navigation', { name: 'Secciones' });

  // Categoría
  await secciones.getByRole('link', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Categorías' }).click();
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const dialogoCategoria = page.getByRole('dialog', { name: 'Nueva categoría' });
  await dialogoCategoria.getByLabel('Nombre').fill('Temporada');
  await dialogoCategoria.getByRole('button', { name: 'Lavanda' }).click();
  await dialogoCategoria.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Temporada' })).toContainText('0 productos');

  // Grupo de modificadores
  await page.getByRole('link', { name: 'Modificadores' }).click();
  await page.getByRole('button', { name: 'Nuevo grupo' }).click();
  const dialogoGrupo = page.getByRole('dialog', { name: 'Nuevo grupo' });
  await dialogoGrupo.getByLabel('Nombre', { exact: true }).fill('Temperatura');
  await dialogoGrupo.getByRole('switch', { name: 'Obligatorio' }).click();
  await dialogoGrupo.getByLabel('Nombre de la opción 1').fill('Caliente');
  await dialogoGrupo.getByRole('switch', { name: 'Opción 1 por defecto' }).click();
  await dialogoGrupo.getByRole('button', { name: 'Agregar opción' }).click();
  await dialogoGrupo.getByLabel('Nombre de la opción 2').fill('Frío');
  await dialogoGrupo.getByLabel('Precio extra de la opción 2').fill('5');
  await dialogoGrupo.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Temperatura' })).toContainText(
    'Caliente, Frío +$5',
  );

  // Producto con imagen y el grupo
  await page.getByRole('link', { name: 'Productos' }).click();
  await page.getByRole('link', { name: 'Agregar producto' }).click();
  await page.getByLabel('Nombre').fill('Ponche de frutas');
  await page.getByRole('button', { name: 'Temporada' }).click();
  await page.getByLabel('Precio').fill('55');
  await page
    .getByLabel('Tomar foto o elegir imagen')
    .setInputFiles({ name: 'ponche.png', mimeType: 'image/png', buffer: PNG_8X8 });
  await expect(page.getByRole('img', { name: 'Imagen del producto' })).toHaveAttribute(
    'src',
    /^data:image\/webp/,
  );
  // El grupo recién creado aparece en Opciones adicionales y se asigna con su casilla
  const opciones = page.getByRole('group', { name: 'Opciones adicionales' });
  await opciones.getByRole('checkbox', { name: /^Temperatura/ }).check();
  await expect(opciones.getByRole('checkbox', { name: /^Temperatura/ })).toBeChecked();
  await expect(page.getByRole('complementary', { name: 'Vista previa' })).toContainText(
    'Ponche de frutas$55.00',
  );
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Ponche de frutas' })).toContainText('$55.00');

  // Se vende al instante
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Temporada' }).click();
  await page.getByRole('button', { name: /^Ponche de frutas/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Ponche de frutas' });
  await expect(hoja.getByRole('button', { name: 'Caliente' })).toHaveAttribute('aria-pressed', 'true');
  await hoja.getByRole('button', { name: /Frío/ }).click();
  await expect(hoja.getByRole('button', { name: /^Agregar/ })).toHaveText('Agregar $60.00');
  await hoja.getByRole('button', { name: /^Agregar/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('dialog', { name: 'Cobro' }).getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText('Venta R-000001');

  await expect
    .poll(async () => (await leerServidor(request))('ventas').find((v) => v.folio === 'R-000001')?.lineas, {
      timeout: 15_000,
    })
    .toEqual([
      expect.objectContaining({
        nombre: 'Ponche de frutas',
        categoriaNombre: 'Temporada',
        precioUnitario: 6000,
        modificadores: [{ grupo: 'Temperatura', opcion: 'Frío', precioExtra: 500 }],
      }),
    ]);
});

test('la encargada edita el menú pero no el precio sin autorización', async ({ page }) => {
  await prepararDispositivo(page, 'S');
  await entrarCon(page, PIN.encargada);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Editar Brownie' }).click();
  await expect(page.getByLabel('Precio')).toBeDisabled();
  await page.getByRole('button', { name: 'Pedir autorización para cambiar el precio' }).click();
  for (const d of PIN.dueno)
    await page
      .getByRole('dialog', { name: 'Pedir autorización' })
      .getByRole('button', { name: d, exact: true })
      .click();
  await expect(page.getByLabel('Precio')).toBeEnabled();
});
