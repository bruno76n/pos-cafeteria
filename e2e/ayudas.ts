import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PIN = { dueno: '1234', encargada: '2222', cajero: '1111' } as const;

/** Inicia sesión con la cuenta demo y configura el dispositivo con la letra indicada. */
export async function prepararDispositivo(page: Page, prefijo: string, nombre = `Caja ${prefijo}`) {
  await page.goto('/acceso');
  await page.getByLabel('Correo').fill('caja@demo.test');
  await page.getByLabel('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByRole('button', { name: new RegExp(`^${prefijo}( |$)`) }).click();
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page).toHaveURL(/\/bloqueo$/);
}

/** Escribe el PIN tocando el teclado propio. */
export async function escribirPin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
}

export async function entrarCon(page: Page, pin: string) {
  await expect(page.getByRole('heading', { name: 'Escribe tu PIN' })).toBeVisible();
  await escribirPin(page, pin);
  await expect(page.getByRole('heading', { name: 'Escribe tu PIN' })).toBeHidden();
}

/** Lee todo lo que tiene el servidor (con la cuenta demo) para comprobar que algo llegó a la base. */
export async function leerServidor(request: APIRequestContext) {
  const acceso = await request.post('/api/acceso', {
    data: { correo: 'caja@demo.test', contrasena: 'demo1234' },
  });
  const { token } = (await acceso.json()) as { token: string };
  const filas: { tabla: string; registro: Record<string, unknown> }[] = [];
  let desde = 0;
  for (;;) {
    const res = await request.get(`/api/sync/pull?desde=${desde}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pagina = (await res.json()) as { filas: typeof filas; rev: number; hayMas: boolean };
    filas.push(...pagina.filas);
    desde = pagina.rev;
    if (!pagina.hayMas) break;
  }
  return (tabla: string) => filas.filter((f) => f.tabla === tabla).map((f) => f.registro);
}

/** Espera a que el indicador diga que no hay ventas por subir. */
export async function esperarSubida(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /^En línea$/ })).toBeVisible({ timeout: 15_000 });
}

/** Abre la caja desde Nueva venta si está cerrada. */
export async function irAVentaConCajaAbierta(page: Page, fondo = '500') {
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: 'Venta', exact: true })
    .click();
  const abrir = page.getByRole('button', { name: 'Abrir caja' });
  const catalogo = page.getByRole('tablist', { name: 'Categorías' });
  await expect(abrir.or(catalogo)).toBeVisible();
  if (await abrir.isVisible()) {
    await abrir.click();
    await page.getByLabel('Fondo inicial').fill(fondo);
    await page.getByRole('dialog').getByRole('button', { name: 'Abrir caja' }).click();
  }
  await expect(catalogo).toBeVisible();
}

export const panelVenta = (page: Page) => page.getByRole('complementary', { name: 'Venta actual' });

/** Lee un valor de `meta` directamente de IndexedDB (para esperar a que una escritura quede confirmada). */
export function leerMetaLocal(page: Page, clave: string) {
  return page.evaluate(
    (c) =>
      new Promise<unknown>((resolver) => {
        const peticion = indexedDB.open('pos-cafeteria');
        peticion.onsuccess = () => {
          const lectura = peticion.result.transaction('meta').objectStore('meta').get(c);
          lectura.onsuccess = () =>
            resolver((lectura.result as { valor?: unknown } | undefined)?.valor ?? null);
        };
      }),
    clave,
  );
}

/** Guarda la configuración del servidor y regresa una función que la restaura (con fecha nueva para que gane). */
export async function respaldarConfig(request: APIRequestContext) {
  const [original] = (await leerServidor(request))('config');
  return async () => {
    const acceso = await request.post('/api/acceso', {
      data: { correo: 'caja@demo.test', contrasena: 'demo1234' },
    });
    const { token } = (await acceso.json()) as { token: string };
    const datos = { ...original, actualizadoEn: new Date().toISOString() };
    await request.post('/api/sync/push', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        operaciones: [
          {
            id: crypto.randomUUID(),
            tabla: 'config',
            tipo: 'actualizar',
            registroId: 'general',
            datos,
            creadaEn: datos.actualizadoEn,
          },
        ],
      },
    });
  };
}

/**
 * Registra el HTML de cada trabajo que se manda a imprimir por el diálogo del sistema (srcdoc del
 * iframe oculto), en orden. El diálogo real bloquea Chromium sin interfaz: se simula.
 */
export async function capturarTrabajos(page: Page) {
  await page.addInitScript(() => {
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
  return () => page.evaluate(() => (window as unknown as { impresos?: string[] }).impresos ?? []);
}
