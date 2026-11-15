import { expect, test, type Page } from '@playwright/test';
import {
  cancelarCuentasAbiertas,
  capturarTrabajos,
  entrarCon,
  irAVentaConCajaAbierta,
  leerServidor,
  esperarSubida,
  panelVenta,
  PIN,
  prepararDispositivo,
  respaldarConfig,
} from './ayudas';

let restaurar: () => Promise<void>;
test.beforeEach(async ({ request }) => {
  restaurar = await respaldarConfig(request);
});
test.afterEach(async ({ request }) => {
  await restaurar();
  await cancelarCuentasAbiertas(request);
});

const irA = async (page: Page, seccion: string, pestana?: string) => {
  await page
    .getByRole('navigation', { name: 'Secciones' })
    // El enlace de Cuentas lleva la cantidad de cuentas abiertas en su nombre.
    .getByRole('link', seccion === 'Cuentas' ? { name: /Cuentas$/ } : { name: seccion, exact: true })
    .click();
  if (pestana) await page.getByRole('link', { name: pestana, exact: true }).click();
};

async function activarImpresionAutomatica(page: Page) {
  await irA(page, 'Configuración', 'Impresora');
  const automatica = page.getByRole('switch', { name: 'Imprimir automáticamente' });
  await automatica.click();
  await expect(automatica).toHaveAttribute('aria-checked', 'true');
}

const brownie = (page: Page) => page.getByRole('button', { name: /^Brownie/ });
const enviado = (page: Page) => panelVenta(page).getByRole('list', { name: 'Enviado a cocina' });
const porEnviar = (page: Page) => panelVenta(page).getByRole('list', { name: 'Por enviar' });

test('enviar a cocina, agregar otro pedido, anular una línea y cobrar la cuenta', async ({
  page,
  request,
}) => {
  const trabajos = await capturarTrabajos(page);
  await prepararDispositivo(page, 'Z', 'Caja cuentas');
  await entrarCon(page, PIN.dueno);
  await activarImpresionAutomatica(page);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();

  // Pedido 1: dos brownies para Luis. Abre la cuenta e imprime su comanda.
  await brownie(page).click();
  await brownie(page).click();
  await panelVenta(page).getByPlaceholder('Nombre del cliente').fill('Luis');
  await panelVenta(page).getByRole('button', { name: 'Enviar a cocina' }).click();
  await expect(panelVenta(page).getByRole('heading', { name: 'Cuenta 1' })).toBeVisible();
  await expect(panelVenta(page)).toContainText('Para: Luis');
  await expect(enviado(page)).toContainText('Comanda 1');
  await expect(enviado(page)).toContainText('Brownie');
  await expect(porEnviar(page)).toBeHidden();
  await expect.poll(async () => (await trabajos()).length).toBe(1);
  const [comanda1] = await trabajos();
  expect(comanda1).toContain('COCINA');
  expect(comanda1).toContain('Cuenta 1');
  expect(comanda1).toContain('Comanda 1');
  expect(comanda1).not.toContain('Comanda 1 de');
  expect(comanda1).toContain('2x Brownie');
  expect(comanda1).toContain('Para: Luis');
  expect(comanda1).not.toContain('$');

  // Pedido 2: un brownie más. Su comanda trae solo lo nuevo.
  await brownie(page).click();
  await expect(porEnviar(page)).toContainText('Brownie');
  await expect(panelVenta(page).getByRole('button', { name: /^Cobrar/ })).toHaveText('Cobrar$135.00');
  await panelVenta(page).getByRole('button', { name: 'Enviar a cocina' }).click();
  await expect(enviado(page)).toContainText('Comanda 2');
  await expect.poll(async () => (await trabajos()).length).toBe(2);
  const comanda2 = (await trabajos())[1]!;
  expect(comanda2).toContain('Comanda 2');
  expect(comanda2).toContain('1x Brownie');
  expect(comanda2).not.toContain('2x');

  // Anular una pieza de la primera comanda: cocina recibe un aviso.
  await enviado(page).getByRole('button', { name: 'Anular Brownie' }).first().click();
  await page
    .getByRole('dialog', { name: 'Anular Brownie' })
    .getByRole('button', { name: 'Anular 1' })
    .click();
  await expect(enviado(page)).toContainText('anulación');
  await expect.poll(async () => (await trabajos()).length).toBe(3);
  const aviso = (await trabajos())[2]!;
  expect(aviso).toContain('ANULACIÓN');
  expect(aviso).toContain('NO PREPARAR');
  expect(aviso).toContain('Comanda 3');
  expect(aviso).toContain('1x Brownie');
  expect(aviso).toContain('(de la comanda 1)');

  // Cobrar la cuenta: la anulación resta.
  await expect(panelVenta(page).getByRole('button', { name: /^Cobrar/ })).toHaveText('Cobrar$90.00');
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobro = page.getByRole('dialog', { name: 'Cobro' });
  await expect(cobro).toContainText('Total a cobrar$90.00');
  await cobro.getByRole('button', { name: 'Exacto' }).click();
  await cobro.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText(/Venta Z-\d{6}/);

  // Un solo ticket con todo, agrupado por comanda.
  await expect.poll(async () => (await trabajos()).length).toBe(4);
  const ticket = (await trabajos())[3]!;
  expect(ticket).toContain('Cuenta: 1');
  expect(ticket).toContain('Comanda 1 de 3');
  expect(ticket).toContain('Comanda 2 de 3');
  expect(ticket).toContain('TOTAL');
  expect(ticket).toContain('$90.00');

  // La cuenta ya no está abierta.
  await irA(page, 'Cuentas');
  await expect(page.getByText('No hay cuentas abiertas.')).toBeVisible();

  // El detalle de la venta muestra su cuenta y reimprime cada comanda por separado.
  await irA(page, 'Ventas');
  await page.getByRole('row').filter({ hasText: 'Brownie' }).getByRole('link').first().click();
  await expect(page.getByText('Cuenta 1', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Reimprimir comanda 2 de 3' }).click();
  await expect.poll(async () => (await trabajos()).length).toBe(5);
  const reimpresa = (await trabajos())[4]!;
  expect(reimpresa).toContain('Comanda 2 de 3');
  expect(reimpresa).toContain('*** REIMPRESIÓN ***');
  expect(reimpresa).toContain('1x Brownie');

  // En el servidor: la venta con su cuenta, la cuenta cobrada y los tres pedidos.
  await esperarSubida(page);
  const servidor = await leerServidor(request);
  const cuenta = servidor('cuentasVenta').find((c) => c.nombre === 'Luis')!;
  expect(cuenta).toMatchObject({ numero: 1, estado: 'cobrada' });
  const venta = servidor('ventas').find((v) => v.cuentaId === cuenta.id)!;
  expect(venta).toMatchObject({ cuentaNumero: 1, cuentaComandas: 3, total: 9000, id: cuenta.ventaId });
  const pedidos = servidor('pedidos').filter((p) => p.cuentaId === cuenta.id);
  expect(pedidos.map((p) => [p.numero, p.tipo]).sort()).toEqual([
    [1, 'normal'],
    [2, 'normal'],
    [3, 'anulacion'],
  ]);
});

test('cuentas abiertas: lista, nueva cuenta con nombre y un borrador por cuenta que sobrevive a recargar', async ({
  page,
}) => {
  await prepararDispositivo(page, 'Y', 'Caja lista');
  await entrarCon(page, PIN.dueno);
  await irAVentaConCajaAbierta(page);

  await irA(page, 'Cuentas');
  await expect(page.getByText('No hay cuentas abiertas.')).toBeVisible();
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  await page.getByRole('dialog', { name: 'Nueva cuenta' }).getByLabel('Nombre (opcional)').fill('Mesa 4');
  await page.getByRole('button', { name: 'Abrir cuenta' }).click();

  // Se abre en Nueva venta con esa cuenta activa.
  await expect(page).toHaveURL(/\/venta$/);
  await expect(panelVenta(page).getByRole('heading', { name: 'Cuenta 1' })).toBeVisible();
  await expect(panelVenta(page)).toContainText('Para: Mesa 4');
  await page.getByRole('tab', { name: 'Postres' }).click();
  await brownie(page).click();
  await panelVenta(page).getByRole('button', { name: 'Enviar a cocina' }).click();
  await expect(enviado(page)).toContainText('Comanda 1');

  // Una segunda cuenta, sin nombre, con su propio borrador sin enviar.
  await irA(page, 'Cuentas');
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  await page.getByRole('button', { name: 'Abrir cuenta' }).click();
  await expect(panelVenta(page).getByRole('heading', { name: 'Cuenta 2' })).toBeVisible();
  await page.getByRole('tab', { name: 'Postres' }).click();
  await brownie(page).click();
  await brownie(page).click();

  // La lista muestra ambas con número, nombre, comandas y total; la barra lateral cuenta las abiertas.
  await irA(page, 'Cuentas');
  await expect(page.getByRole('heading', { name: 'Cuentas abiertas (2)' })).toBeVisible();
  const tarjeta1 = page.getByRole('button', { name: /Cuenta 1/ });
  await expect(tarjeta1).toContainText('Mesa 4');
  await expect(tarjeta1).toContainText('1 comanda');
  await expect(tarjeta1).toContainText('$45.00');
  const tarjeta2 = page.getByRole('button', { name: /Cuenta 2/ });
  await expect(tarjeta2).toContainText('Sin nombre');
  await expect(tarjeta2).toContainText('0 comandas');
  await expect(tarjeta2).toContainText('$0.00');
  await expect(
    page.getByRole('navigation', { name: 'Secciones' }).getByLabel('2 cuentas abiertas'),
  ).toBeVisible();

  // El borrador de la cuenta 2 sigue ahí después de recargar y de cambiar de cuenta.
  await page.reload();
  await entrarCon(page, PIN.dueno);
  await tarjeta1.click();
  await expect(panelVenta(page).getByRole('heading', { name: 'Cuenta 1' })).toBeVisible();
  await expect(porEnviar(page)).toBeHidden();
  await irA(page, 'Cuentas');
  await tarjeta2.click();
  await expect(panelVenta(page).getByRole('heading', { name: 'Cuenta 2' })).toBeVisible();
  await expect(porEnviar(page)).toContainText('Brownie');
  await expect(porEnviar(page).getByText('2', { exact: true })).toBeVisible();
});

test('cerrar caja con cuentas abiertas avisa, deja cerrar y la cuenta se cobra en el turno siguiente', async ({
  page,
  request,
}) => {
  await prepararDispositivo(page, 'X', 'Caja cierre');
  await entrarCon(page, PIN.dueno);
  await irAVentaConCajaAbierta(page, '500');
  await page.getByRole('tab', { name: 'Postres' }).click();
  await brownie(page).click();
  await panelVenta(page).getByPlaceholder('Nombre del cliente').fill('Luis');
  await panelVenta(page).getByRole('button', { name: 'Enviar a cocina' }).click();
  await expect(enviado(page)).toContainText('Comanda 1');

  // Inicio cuenta las abiertas.
  await irA(page, 'Inicio');
  await expect(page.getByRole('link', { name: '1 cuenta abierta' }).last()).toBeVisible();

  // Caja avisa cuáles son pero deja cerrar.
  await irA(page, 'Caja');
  await expect(page.getByRole('status').filter({ hasText: 'Hay 1 cuenta abierta' })).toHaveText(
    'Hay 1 cuenta abierta (Cuenta 1 · Luis). Se cobrará en el turno que esté abierto.',
  );
  await page.getByLabel('Piezas de Billete de $200', { exact: true }).fill('2');
  await page.getByLabel('Piezas de Billete de $100', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Cerrar caja' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Caja cerrada.' })).toBeVisible();

  // La cuenta sigue abierta; en el turno nuevo se cobra.
  await irAVentaConCajaAbierta(page, '300');
  await irA(page, 'Cuentas');
  await page.getByRole('button', { name: /Cuenta 1/ }).click();
  await expect(enviado(page)).toContainText('Brownie');
  await panelVenta(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobro = page.getByRole('dialog', { name: 'Cobro' });
  await cobro.getByRole('button', { name: 'Exacto' }).click();
  await cobro.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(panelVenta(page).getByRole('status')).toContainText(/Venta X-\d{6}/);

  // La venta toma el turno del cobro; la cuenta conserva el de apertura.
  await esperarSubida(page);
  const servidor = await leerServidor(request);
  const cuenta = servidor('cuentasVenta').find((c) => c.dispositivoNombre === 'Caja cierre')!;
  const venta = servidor('ventas').find((v) => v.cuentaId === cuenta.id)!;
  expect(cuenta).toMatchObject({ estado: 'cobrada', ventaId: venta.id });
  expect(venta.turnoId).not.toBe(cuenta.turnoId);
});

test('cobrar desde otra tablet y doble cobro rechazado con un mensaje claro', async ({
  browser,
  request,
}) => {
  test.setTimeout(150_000); // las tablets se ven entre sí en el siguiente pull (cada 15 s)
  const contextoA = await browser.newContext({ locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const contextoB = await browser.newContext({ locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const a = await contextoA.newPage();
  const b = await contextoB.newPage();
  await prepararDispositivo(a, 'U', 'Caja uno');
  await prepararDispositivo(b, 'V', 'Caja dos');
  await entrarCon(a, PIN.dueno);
  await entrarCon(b, PIN.dueno);

  // La tablet A abre una cuenta y manda su pedido a cocina.
  await irAVentaConCajaAbierta(a);
  await a.getByRole('tab', { name: 'Postres' }).click();
  await brownie(a).click();
  await panelVenta(a).getByPlaceholder('Nombre del cliente').fill('Marta');
  await panelVenta(a).getByRole('button', { name: 'Enviar a cocina' }).click();
  await expect(enviado(a)).toContainText('Comanda 1');
  await esperarSubida(a);

  // La tablet B la recibe con su pedido y la cobra.
  await irAVentaConCajaAbierta(b);
  await irA(b, 'Cuentas');
  const tarjeta = b.getByRole('button', { name: /Marta/ });
  await expect(tarjeta).toBeVisible({ timeout: 30_000 });
  await tarjeta.click();
  await expect(enviado(b)).toContainText('Brownie');
  await panelVenta(b)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
  const cobroB = b.getByRole('dialog', { name: 'Cobro' });
  await cobroB.getByRole('button', { name: 'Exacto' }).click();
  await cobroB.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(panelVenta(b).getByRole('status')).toContainText(/Venta V-\d{6}/);
  await esperarSubida(b);

  // La tablet A ve que la cuenta ya no está abierta.
  await irA(a, 'Cuentas');
  await expect(a.getByText('No hay cuentas abiertas.')).toBeVisible({ timeout: 30_000 });

  // Doble cobro: las dos tablets cobran sin conexión la misma cuenta.
  await irA(a, 'Venta');
  await a.getByRole('tab', { name: 'Postres' }).click();
  await brownie(a).click();
  await panelVenta(a).getByPlaceholder('Nombre del cliente').fill('Pepe');
  await panelVenta(a).getByRole('button', { name: 'Enviar a cocina' }).click();
  await esperarSubida(a);
  await irA(b, 'Cuentas');
  await expect(b.getByRole('button', { name: /Pepe/ })).toBeVisible({ timeout: 30_000 });
  await b.getByRole('button', { name: /Pepe/ }).click();
  await expect(enviado(b)).toContainText('Brownie');

  await contextoA.setOffline(true);
  await contextoB.setOffline(true);
  for (const pagina of [a, b]) {
    await panelVenta(pagina)
      .getByRole('button', { name: /^Cobrar/ })
      .click();
    const cobro = pagina.getByRole('dialog', { name: 'Cobro' });
    await cobro.getByRole('button', { name: 'Exacto' }).click();
    await cobro.getByRole('button', { name: 'Confirmar cobro' }).click();
    await expect(panelVenta(pagina).getByRole('status')).toContainText(/Venta [UV]-\d{6}/);
  }
  await contextoA.setOffline(false);
  await contextoB.setOffline(false);

  // Una venta gana; la otra tablet avisa al Administrador que la cuenta ya se cobró.
  const aviso = (p: Page) =>
    p.getByRole('alert').filter({ hasText: 'Esta cuenta ya se cobró en otro dispositivo.' });
  await expect
    .poll(async () => (await aviso(a).count()) + (await aviso(b).count()), { timeout: 40_000 })
    .toBe(1);
  await expect
    .poll(async () => {
      const servidor = await leerServidor(request);
      const cuenta = servidor('cuentasVenta').find((c) => c.nombre === 'Pepe')!;
      return servidor('ventas').filter((v) => v.cuentaId === cuenta.id).length;
    })
    .toBe(1);

  await contextoA.close();
  await contextoB.close();
  await cancelarCuentasAbiertas(request);
});

test('cancelar una cuenta: pide motivo, avisa a cocina y no genera venta; una cuenta vacía se descarta', async ({
  page,
  request,
}) => {
  const trabajos = await capturarTrabajos(page);
  await prepararDispositivo(page, 'W', 'Caja cancelar');
  await entrarCon(page, PIN.dueno);
  await activarImpresionAutomatica(page);
  await irAVentaConCajaAbierta(page);
  await page.getByRole('tab', { name: 'Postres' }).click();
  await brownie(page).click();
  await brownie(page).click();
  await panelVenta(page).getByPlaceholder('Nombre del cliente').fill('Rosa');
  await panelVenta(page).getByRole('button', { name: 'Enviar a cocina' }).click();
  await expect(enviado(page)).toContainText('Comanda 1');
  await expect.poll(async () => (await trabajos()).length).toBe(1);

  await panelVenta(page).getByRole('button', { name: 'Cancelar cuenta' }).click();
  const dialogo = page.getByRole('dialog', { name: /^Cancelar Cuenta 1/ });
  await expect(dialogo).toContainText('Esta cuenta ya se mandó a cocina.');
  await dialogo.getByRole('button', { name: 'Cancelar y avisar a cocina' }).click();
  await expect(dialogo.getByText('Escribe el motivo.')).toBeVisible();
  await dialogo.getByLabel('Motivo').fill('Se fue');
  await dialogo.getByRole('button', { name: 'Cancelar y avisar a cocina' }).click();

  await expect(panelVenta(page).getByRole('heading', { name: 'Venta actual' })).toBeVisible();
  await expect.poll(async () => (await trabajos()).length).toBe(2);
  const aviso = (await trabajos())[1]!;
  expect(aviso).toContain('CANCELADA');
  expect(aviso).toContain('NO PREPARAR');
  expect(aviso).toContain('Cuenta 1');
  expect(aviso).toContain('2x Brownie');
  expect(aviso).toContain('Para: Rosa');

  // Una cuenta sin pedidos se descarta sin pedir motivo.
  await irA(page, 'Cuentas');
  await expect(page.getByText('No hay cuentas abiertas.')).toBeVisible();
  await page.getByRole('button', { name: 'Nueva cuenta' }).click();
  await page.getByRole('button', { name: 'Abrir cuenta' }).click();
  await panelVenta(page).getByRole('button', { name: 'Cancelar cuenta' }).click();
  const vacia = page.getByRole('dialog', { name: /^Cancelar Cuenta 2/ });
  await expect(vacia.getByLabel('Motivo')).toBeHidden();
  await vacia.getByRole('button', { name: 'Cancelar cuenta' }).click();
  await expect(panelVenta(page).getByRole('heading', { name: 'Venta actual' })).toBeVisible();

  const delServidor = async () => {
    const servidor = await leerServidor(request);
    const cuentas = servidor('cuentasVenta').filter((c) => c.dispositivoNombre === 'Caja cancelar');
    return { servidor, cuentas };
  };
  await expect
    .poll(async () => (await delServidor()).cuentas.map((c) => c.estado), { timeout: 20_000 })
    .toEqual(['cancelada', 'cancelada']);
  const { servidor, cuentas } = await delServidor();
  expect(cuentas.find((c) => c.nombre === 'Rosa')?.cancelacion).toMatchObject({ motivo: 'Se fue' });
  expect(servidor('ventas').filter((v) => cuentas.some((c) => c.id === v.cuentaId))).toHaveLength(0);
});
