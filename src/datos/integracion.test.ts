// @vitest-environment node
// La app (Dexie sobre fake-indexeddb) sincroniza contra la API real con PGlite en memoria.
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { crearApp } from '../../servidor/app';
import { crearBasePrueba } from '../../servidor/db/basePrueba';
import type { ConexionBaseDatos } from '../../servidor/db/cliente';
import { ventas as tablaVentas } from '../../servidor/db/esquema';
import { CUENTA_DEMO, sembrar } from '../../scripts/seed';
import { calcularTotales, carritoVacio, agregarLinea, crearLinea, lineasParaVenta } from '@/dominio/carrito';
import { ahoraISO, diaLocal } from '@/dominio/fechas';
import { api } from './api';
import { bd, guardarMeta } from './bd';
import { crear, guardar, registrarVenta } from './escrituras';
import { MotorSync } from './sync';

let conexion: ConexionBaseDatos;

beforeAll(async () => {
  conexion = await crearBasePrueba();
  await sembrar(conexion.db);
  const app = crearApp({ db: conexion.db, jwtSecret: 'integracion' });
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    app.fetch(new Request(new URL(url, 'http://local'), init)),
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await conexion.cerrar();
});

async function iniciarDispositivo() {
  await Promise.all(bd.tables.map((t) => t.clear()));
  const acceso = await api.acceso(CUENTA_DEMO.correo, CUENTA_DEMO.contrasena);
  await guardarMeta('sesion', { token: acceso.token, cuenta: acceso.cuenta, expirada: false });
  const motor = new MotorSync(api);
  expect(await motor.sincronizar()).toBe('ok');
  return motor;
}

test('una venta hecha en un dispositivo llega a la base y al otro dispositivo', async () => {
  // Dispositivo A: primer pull trae menú, configuración y usuarios
  const motorA = await iniciarDispositivo();
  expect(await bd.productos.count()).toBe(28);
  expect((await bd.config.get('general'))?.datos.negocio.nombre).toBe('Cafetería Demo');
  const cajero = (await bd.usuarios.get('cajero'))!;

  await guardarMeta('dispositivoId', 'caja-a');
  await guardar('dispositivos', {
    id: 'caja-a',
    nombre: 'Caja 1',
    tipo: 'caja',
    prefijo: 'A',
    ultimoFolio: 0,
  });
  const turno = await crear('turnos', {
    id: crypto.randomUUID(),
    dispositivoId: 'caja-a',
    dispositivoNombre: 'Caja 1',
    estado: 'abierto',
    abiertoPor: { id: cajero.id, nombre: cajero.nombre },
    abiertoEn: ahoraISO(),
    dia: diaLocal(),
    fondoInicial: 50000,
  });

  const brownie = (await bd.productos.get('brownie'))!;
  const carrito = agregarLinea(
    carritoVacio(),
    crearLinea({ producto: brownie, categoria: await bd.categorias.get('postres'), grupos: [] }),
  );
  const config = (await bd.config.get('general'))!.datos;
  const totales = calcularTotales(carrito.lineas, null, config.ventas);
  const venta = await registrarVenta({
    id: crypto.randomUUID(),
    dispositivoId: 'caja-a',
    dispositivoNombre: 'Caja 1',
    turnoId: turno.id,
    fecha: ahoraISO(),
    dia: diaLocal(),
    cajero: { id: cajero.id, nombre: cajero.nombre },
    cliente: null,
    lineas: lineasParaVenta(carrito),
    subtotal: totales.subtotal,
    descuento: null,
    iva: totales.iva,
    total: totales.total,
    pagos: [{ metodo: 'efectivo', monto: totales.total, recibido: 5000 }],
    cambio: 5000 - totales.total,
    estado: 'pagada',
    devuelto: 0,
    cancelacion: null,
  });
  expect(venta.folio).toBe('A-000001');
  expect(await bd.outbox.count()).toBe(4);

  expect(await motorA.sincronizar()).toBe('ok');
  expect(await bd.outbox.count()).toBe(0);
  const enServidor = await conexion.db.select().from(tablaVentas);
  expect(enServidor.map((v) => v.folio)).toEqual(['A-000001']);
  expect(enServidor[0]).toMatchObject({ total: 4500, cambio: 500, turnoId: turno.id });

  // Dispositivo B: base local vacía, inicia sesión y hace pull
  await iniciarDispositivo();
  const recibida = await bd.ventas.get(venta.id);
  expect(recibida).toEqual(venta);
  expect((await bd.turnos.get(turno.id))?.estado).toBe('abierto');
  expect((await bd.dispositivos.get('caja-a'))?.ultimoFolio).toBe(1);
});
