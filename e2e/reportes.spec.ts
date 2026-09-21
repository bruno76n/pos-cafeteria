import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  entrarCon,
  esperarSubida,
  irAVentaConCajaAbierta,
  leerServidor,
  panelVenta,
  PIN,
  prepararDispositivo,
} from './ayudas';

const pesos = (centavos: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format((centavos || 0) / 100);

async function vender(page: Page, cantidad: number, metodo: 'Efectivo' | 'Tarjeta') {
  for (let i = 0; i < cantidad; i++) await page.getByRole('button', { name: /^Tamal de reporte/ }).click();
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobro = page.getByRole('dialog', { name: 'Cobro' });
  if (metodo === 'Efectivo') {
    await cobro.getByRole('button', { name: 'Exacto' }).click();
    await cobro.getByRole('button', { name: 'Confirmar cobro' }).click();
  } else {
    await cobro.getByRole('tab', { name: 'Tarjeta' }).click();
    await cobro.getByRole('button', { name: 'Pagado con tarjeta' }).click();
  }
  await expect(cobro).toBeHidden();
}

test('las cifras de Reportes coinciden con las ventas', async ({ page, request }) => {
  await prepararDispositivo(page, 'Z');
  await entrarCon(page, PIN.dueno);

  // Producto propio de esta prueba para verlo aislado en la pestaña Productos
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Menú' }).click();
  await page.getByRole('link', { name: 'Agregar producto' }).click();
  await page.getByLabel('Nombre').fill('Tamal de reporte');
  await page.getByRole('button', { name: 'Extras' }).click();
  await page.getByLabel('Precio').fill('30');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Extras' }).click();
  await vender(page, 3, 'Efectivo'); // Z-000001 $90
  await vender(page, 1, 'Tarjeta'); // Z-000002 $30
  await vender(page, 1, 'Efectivo'); // Z-000003 $30 → se cancela
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Ventas' }).click();
  await page.getByRole('link', { name: 'Z-000003' }).click();
  await page.getByRole('button', { name: 'Cancelar venta' }).click();
  await page.getByRole('dialog').getByLabel('Motivo').fill('Prueba de reporte');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar venta' }).click();
  await esperarSubida(page);

  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Reportes' }).click();

  // Productos: 4 tamales vendidos por $120 (la venta cancelada no cuenta)
  await page.getByRole('tab', { name: 'Productos' }).click();
  const fila = page.getByRole('row').filter({ hasText: 'Tamal de reporte' });
  await expect(fila).toContainText('Extras4$120.00');

  // Exportar CSV (UTF-8 con BOM)
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const archivo = await (await descarga).path();
  const csv = readFileSync(archivo, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('Tamal de reporte,Extras,4,120.00');

  // Resumen: coincide con lo que tiene el servidor para hoy
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const leer = await leerServidor(request);
  const ventas = leer('ventas').filter((v) => v.dia === hoy) as {
    total: number;
    estado: string;
    pagos: { metodo: string; monto: number }[];
  }[];
  const devueltas = leer('devoluciones').filter((d) => d.dia === hoy) as { monto: number }[];
  const vigentes = ventas.filter((v) => v.estado !== 'cancelada');
  const suma = (xs: { total: number }[]) => xs.reduce((s, v) => s + v.total, 0);
  const brutas = suma(ventas);
  const canceladas = suma(ventas.filter((v) => v.estado === 'cancelada'));
  const devuelto = devueltas.reduce((s, d) => s + d.monto, 0);
  const porMetodo = (m: string) =>
    vigentes
      .flatMap((v) => v.pagos)
      .filter((p) => p.metodo === m)
      .reduce((s, p) => s + p.monto, 0);

  await page.getByRole('tab', { name: 'Resumen' }).click();
  const resumen = page.getByRole('region', { name: 'Resumen' });
  await expect(resumen).toContainText(`Ventas brutas${pesos(brutas)}`);
  await expect(resumen).toContainText(`Ventas netas${pesos(brutas - canceladas - devuelto)}`);
  await expect(resumen).toContainText(`Número de ventas${vigentes.length}`);
  await expect(resumen).toContainText(`Efectivo${pesos(porMetodo('efectivo'))}`);
  await expect(resumen).toContainText(`Tarjeta${pesos(porMetodo('tarjeta'))}`);

  // Cajeros: el Dueño tiene al menos estas ventas y la cancelación
  await page.getByRole('tab', { name: 'Cajeros' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Dueño' })).toBeVisible();
});
