import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { categoriaPrueba, configPrueba, ventaPrueba } from '../src/dominio/datosPrueba';
import { diaLocal, sumarDias } from '../src/dominio/fechas';
import type { Operacion, RespuestaPull, RespuestaPush, Venta } from '../src/dominio/tipos';
import { crearApp } from './app';
import { firmarToken, hashContrasena } from './auth';
import { crearBasePrueba } from './db/basePrueba';
import type { ConexionBaseDatos } from './db/cliente';
import { config, cuentas, ventas } from './db/esquema';

const SECRETO = 'secreto-de-prueba';
let conexion: ConexionBaseDatos;
let app: ReturnType<typeof crearApp>;
let token: string;

beforeAll(async () => {
  conexion = await crearBasePrueba();
  await conexion.db.insert(cuentas).values([
    { id: 'cuenta-1', correo: 'caja@demo.test', hashContrasena: await hashContrasena('demo1234') },
    {
      id: 'cuenta-2',
      correo: 'baja@demo.test',
      hashContrasena: await hashContrasena('demo1234'),
      activa: false,
    },
  ]);
  token = await firmarToken('cuenta-1', SECRETO);
});
afterAll(() => conexion.cerrar());
beforeEach(() => {
  app = crearApp({ db: conexion.db, jwtSecret: SECRETO });
});

const ahora = () => new Date().toISOString();
const ana = { id: 'u1', nombre: 'Ana' };

function op(parcial: Pick<Operacion, 'tabla' | 'tipo' | 'registroId' | 'datos'>): Operacion {
  return { id: crypto.randomUUID(), creadaEn: ahora(), ...parcial };
}

function ventaDeHoy(cambios: Partial<Venta> = {}): Venta {
  return ventaPrueba({
    id: crypto.randomUUID(),
    fecha: ahora(),
    dia: diaLocal(),
    actualizadoEn: ahora(),
    ...cambios,
  });
}

async function push(operaciones: Operacion[], conToken = token) {
  const res = await app.request('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${conToken}` },
    body: JSON.stringify({ operaciones }),
  });
  return { status: res.status, cuerpo: (await res.json()) as RespuestaPush };
}

async function pull(desde: number) {
  const res = await app.request(`/api/sync/pull?desde=${desde}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as RespuestaPull;
}

/** Todas las páginas desde un cursor. */
async function pullCompleto(desde: number) {
  let r = await pull(desde);
  const filas = [...r.filas];
  while (r.hayMas) {
    r = await pull(r.rev);
    filas.push(...r.filas);
  }
  return { filas, rev: r.rev };
}

const acceso = (correo: string, contrasena: string, ip = '1.1.1.1') =>
  app.request('/api/acceso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ correo, contrasena }),
  });

describe('acceso', () => {
  test('correo y contraseña correctos regresan un token', async () => {
    const res = await acceso('Caja@Demo.test', 'demo1234');
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as { token: string; cuenta: { correo: string } };
    expect(cuerpo.cuenta.correo).toBe('caja@demo.test');
    expect(cuerpo.token.split('.')).toHaveLength(3);
  });

  test('contraseña incorrecta', async () => {
    const res = await acceso('caja@demo.test', 'mala');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Correo o contraseña incorrectos.' });
  });

  test('cuenta desactivada no entra', async () => {
    expect((await acceso('baja@demo.test', 'demo1234')).status).toBe(401);
  });

  test('tras 5 intentos fallidos desde la misma IP hay que esperar', async () => {
    for (let i = 0; i < 5; i++) expect((await acceso('caja@demo.test', 'mala', '9.9.9.9')).status).toBe(401);
    expect((await acceso('caja@demo.test', 'demo1234', '9.9.9.9')).status).toBe(429);
    expect((await acceso('caja@demo.test', 'demo1234', '8.8.8.8')).status).toBe(200);
  });
});

describe('token', () => {
  test('sin token → 401', async () => {
    expect((await app.request('/api/sync/pull?desde=0')).status).toBe(401);
    expect((await app.request('/api/reportes?desde=2026-09-01&hasta=2026-09-02')).status).toBe(401);
    const res = await app.request('/api/sync/push', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  test('token inválido o de otro secreto → 401', async () => {
    const ajeno = await firmarToken('cuenta-1', 'otro-secreto');
    expect((await push([], ajeno)).status).toBe(401);
    expect((await push([], 'basura')).status).toBe(401);
  });

  test('token de cuenta desactivada → 401', async () => {
    const deBaja = await firmarToken('cuenta-2', SECRETO);
    expect(
      (await push([op({ tabla: 'ventas', tipo: 'crear', registroId: 'x', datos: {} })], deBaja)).status,
    ).toBe(401);
  });

  test('salud no pide token', async () => {
    expect((await app.request('/api/salud')).status).toBe(200);
  });
});

describe('push', () => {
  test('crear la misma venta dos veces deja una sola fila', async () => {
    const venta = ventaDeHoy({ folio: 'A-000001', folioNumero: 1 });
    const crear = op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta });
    expect((await push([crear])).cuerpo.resultados[0]).toEqual({ id: crear.id, resultado: 'aplicada' });
    // reenviar la misma operación
    expect((await push([crear])).cuerpo.resultados[0]?.resultado).toBe('duplicada');
    // otra operación con el mismo registro
    const otra = op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta });
    expect((await push([otra])).cuerpo.resultados[0]?.resultado).toBe('duplicada');
    const filas = await conexion.db.select().from(ventas).where(eq(ventas.id, venta.id));
    expect(filas).toHaveLength(1);
  });

  test('actualizar un campo prohibido de una venta se rechaza', async () => {
    const venta = ventaDeHoy({ folio: 'A-000002', folioNumero: 2 });
    await push([op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta })]);
    const { cuerpo } = await push([
      op({
        tabla: 'ventas',
        tipo: 'actualizar',
        registroId: venta.id,
        datos: { total: 1, actualizadoEn: ahora() },
      }),
    ]);
    expect(cuerpo.resultados[0]).toMatchObject({
      resultado: 'rechazada',
      motivo: 'No se puede cambiar el campo total en ventas.',
    });
    const [fila] = await conexion.db.select().from(ventas).where(eq(ventas.id, venta.id));
    expect(fila?.total).toBe(venta.total);
  });

  test('cancelar una venta cambia solo estado y cancelación', async () => {
    const venta = ventaDeHoy({ folio: 'A-000003', folioNumero: 3 });
    await push([op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta })]);
    const cancelacion = { motivo: 'Error', usuario: ana, autorizadoPor: null, fecha: ahora() };
    const { cuerpo } = await push([
      op({
        tabla: 'ventas',
        tipo: 'actualizar',
        registroId: venta.id,
        datos: { estado: 'cancelada', cancelacion, actualizadoEn: ahora() },
      }),
    ]);
    expect(cuerpo.resultados[0]?.resultado).toBe('aplicada');
    const [fila] = await conexion.db.select().from(ventas).where(eq(ventas.id, venta.id));
    expect(fila).toMatchObject({ estado: 'cancelada', cancelacion, total: venta.total });
  });

  test('borrar una venta se rechaza', async () => {
    const { cuerpo } = await push([
      op({ tabla: 'ventas', tipo: 'borrar', registroId: 'v', datos: { actualizadoEn: ahora() } }),
    ]);
    expect(cuerpo.resultados[0]?.resultado).toBe('rechazada');
  });

  test('un turno cerrado ya no se modifica', async () => {
    const turno = {
      id: crypto.randomUUID(),
      dispositivoId: 'd1',
      dispositivoNombre: 'Caja 1',
      estado: 'abierto',
      abiertoPor: ana,
      abiertoEn: ahora(),
      dia: diaLocal(),
      fondoInicial: 50000,
      actualizadoEn: ahora(),
    };
    const cerrar = {
      estado: 'cerrado',
      cerradoPor: ana,
      cerradoEn: ahora(),
      efectivoContado: 50000,
      actualizadoEn: ahora(),
    };
    const { cuerpo } = await push([
      op({ tabla: 'turnos', tipo: 'crear', registroId: turno.id, datos: turno }),
      op({ tabla: 'turnos', tipo: 'actualizar', registroId: turno.id, datos: cerrar }),
      op({
        tabla: 'turnos',
        tipo: 'actualizar',
        registroId: turno.id,
        datos: { nota: 'después', actualizadoEn: ahora() },
      }),
    ]);
    expect(cuerpo.resultados.map((r) => r.resultado)).toEqual(['aplicada', 'aplicada', 'rechazada']);
  });

  test('un folio repetido de otro dispositivo se rechaza', async () => {
    const a = ventaDeHoy({ folio: 'B-000001', folioNumero: 1 });
    const b = ventaDeHoy({ folio: 'B-000001', folioNumero: 1, dispositivoId: 'otro' });
    const { cuerpo } = await push([
      op({ tabla: 'ventas', tipo: 'crear', registroId: a.id, datos: a }),
      op({ tabla: 'ventas', tipo: 'crear', registroId: b.id, datos: b }),
    ]);
    expect(cuerpo.resultados[1]).toMatchObject({ resultado: 'rechazada' });
    expect(cuerpo.resultados[1]?.motivo).toContain('B-000001');
  });

  test('en el catálogo gana el cambio más reciente', async () => {
    const cafes = { ...categoriaPrueba('cafes'), id: 'cat-lww', actualizadoEn: '2026-09-19T12:00:00.000Z' };
    const nuevo = { ...cafes, nombre: 'Nuevo', actualizadoEn: '2026-09-19T13:00:00.000Z' };
    const viejo = { ...cafes, nombre: 'Viejo', actualizadoEn: '2026-09-19T12:30:00.000Z' };
    const { cuerpo } = await push([
      op({ tabla: 'categorias', tipo: 'crear', registroId: cafes.id, datos: cafes }),
      op({ tabla: 'categorias', tipo: 'actualizar', registroId: cafes.id, datos: nuevo }),
      op({ tabla: 'categorias', tipo: 'actualizar', registroId: cafes.id, datos: viejo }),
    ]);
    expect(cuerpo.resultados.map((r) => r.resultado)).toEqual(['aplicada', 'aplicada', 'duplicada']);
    const { filas } = await pullCompleto(0);
    expect(filas.find((f) => f.registro.id === 'cat-lww')?.registro.nombre).toBe('Nuevo');
  });

  test('lote inválido o de más de 100 operaciones → 400', async () => {
    expect((await push([])).status).toBe(400);
    const muchas = Array.from({ length: 101 }, () =>
      op({ tabla: 'ventas', tipo: 'crear', registroId: 'x', datos: {} }),
    );
    expect((await push(muchas)).status).toBe(400);
  });
});

describe('pull', () => {
  test('devuelve solo lo posterior al cursor, en orden de rev', async () => {
    const { rev: cursor } = await pullCompleto(0);
    const venta = ventaDeHoy({ folio: 'C-000001', folioNumero: 1 });
    await push([op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta })]);
    const r = await pull(cursor);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({
      tabla: 'ventas',
      borrado: false,
      registro: { id: venta.id, folio: 'C-000001' },
    });
    expect(r.filas[0]!.registro).toEqual({ ...venta });
    expect(r.rev).toBeGreaterThan(cursor);
    expect((await pull(r.rev)).filas).toEqual([]);
  });

  test('pagina de 500 en 500', async () => {
    const { rev: cursor } = await pullCompleto(0);
    const lote = (n: number) =>
      Array.from({ length: 100 }, (_, i) => {
        const c = { ...categoriaPrueba('cafes'), id: `pag-${n}-${i}`, actualizadoEn: ahora() };
        return op({ tabla: 'categorias', tipo: 'crear', registroId: c.id, datos: c });
      });
    for (let n = 0; n < 6; n++) await push(lote(n));
    const p1 = await pull(cursor);
    expect(p1.filas).toHaveLength(500);
    expect(p1.hayMas).toBe(true);
    const p2 = await pull(p1.rev);
    expect(p2.filas).toHaveLength(100);
    expect(p2.hayMas).toBe(false);
    expect(p2.filas.every((f) => f.rev > p1.rev)).toBe(true);
  });

  test('ventas de hace más de 35 días no bajan', async () => {
    const vieja = ventaDeHoy({ folio: 'D-000001', folioNumero: 1, dia: sumarDias(diaLocal(), -40) });
    await push([op({ tabla: 'ventas', tipo: 'crear', registroId: vieja.id, datos: vieja })]);
    const { filas } = await pullCompleto(0);
    expect(filas.some((f) => f.registro.id === vieja.id)).toBe(false);
  });

  test('un producto borrado baja como lápida', async () => {
    const producto = {
      id: 'prod-borrar',
      nombre: 'Temporal',
      descripcion: '',
      categoriaId: 'cafes',
      precio: 1000,
      imagen: null,
      disponible: true,
      orden: 1,
      gruposIds: [],
      actualizadoEn: '2026-09-19T12:00:00.000Z',
    };
    await push([op({ tabla: 'productos', tipo: 'crear', registroId: producto.id, datos: producto })]);
    const { rev: antes } = await pullCompleto(0);
    const { cuerpo } = await push([
      op({
        tabla: 'productos',
        tipo: 'borrar',
        registroId: producto.id,
        datos: { actualizadoEn: '2026-09-19T13:00:00.000Z' },
      }),
    ]);
    expect(cuerpo.resultados[0]?.resultado).toBe('aplicada');
    const { filas } = await pull(antes);
    expect(filas.find((f) => f.registro.id === producto.id)).toMatchObject({ borrado: true });
  });

  test('un producto de una versión anterior (sin tamaños) baja con la lista vacía', async () => {
    const producto = {
      id: 'prod-viejo',
      nombre: 'Americano',
      descripcion: '',
      categoriaId: 'cafes',
      precio: 4500,
      imagen: null,
      disponible: true,
      orden: 1,
      gruposIds: [],
      actualizadoEn: ahora(),
    };
    const { rev: antes } = await pullCompleto(0);
    await push([op({ tabla: 'productos', tipo: 'crear', registroId: producto.id, datos: producto })]);
    const { filas } = await pull(antes);
    expect(filas.find((f) => f.registro.id === producto.id)?.registro).toMatchObject({ tamanos: [] });
  });

  test('los ingredientes suben, bajan y se borran como el resto del catálogo', async () => {
    const nutella = {
      id: 'ing-nutella',
      nombre: 'Nutella',
      grupo: 'Dulces',
      orden: 1,
      disponible: true,
      actualizadoEn: '2026-09-19T12:00:00.000Z',
    };
    const { rev: antes } = await pullCompleto(0);
    const creado = await push([
      op({ tabla: 'ingredientes', tipo: 'crear', registroId: nutella.id, datos: nutella }),
    ]);
    expect(creado.cuerpo.resultados[0]?.resultado).toBe('aplicada');
    const { filas, rev } = await pull(antes);
    expect(filas.find((f) => f.registro.id === nutella.id)).toMatchObject({
      tabla: 'ingredientes',
      borrado: false,
      registro: { nombre: 'Nutella', grupo: 'Dulces' },
    });
    const sinNombre = await push([
      op({
        tabla: 'ingredientes',
        tipo: 'actualizar',
        registroId: nutella.id,
        datos: { ...nutella, nombre: '' },
      }),
    ]);
    expect(sinNombre.cuerpo.resultados[0]?.resultado).toBe('rechazada');
    await push([
      op({
        tabla: 'ingredientes',
        tipo: 'borrar',
        registroId: nutella.id,
        datos: { actualizadoEn: '2026-09-19T13:00:00.000Z' },
      }),
    ]);
    const despues = await pull(rev);
    expect(despues.filas.find((f) => f.registro.id === nutella.id)).toMatchObject({ borrado: true });
  });
});

describe('reportes', () => {
  const pedir = (q: string) =>
    app.request(`/api/reportes?${q}`, { headers: { Authorization: `Bearer ${token}` } });

  test('devuelve las filas del rango', async () => {
    const venta = ventaDeHoy({
      folio: 'E-000001',
      folioNumero: 1,
      dia: '2025-01-15',
      fecha: '2025-01-15T18:00:00.000Z',
    });
    await push([op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta })]);
    const res = await pedir('desde=2025-01-01&hasta=2025-01-31');
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as { ventas: Venta[] };
    expect(cuerpo.ventas.map((v) => v.folio)).toEqual(['E-000001']);
  });

  test('rango inválido o de más de 92 días → 400', async () => {
    expect((await pedir('desde=2025-01-31&hasta=2025-01-01')).status).toBe(400);
    expect((await pedir('desde=2025-01-01&hasta=2025-06-01')).status).toBe(400);
    expect((await pedir('desde=x&hasta=y')).status).toBe(400);
  });
});

describe('ticket público', () => {
  test('devuelve solo la venta pedida, sin token', async () => {
    const venta = ventaDeHoy({ folio: 'Q-000001', folioNumero: 1 });
    await push([op({ tabla: 'ventas', tipo: 'crear', registroId: venta.id, datos: venta })]);
    await conexion.db
      .insert(config)
      .values({ id: 'general', datos: configPrueba, actualizadoEn: new Date() })
      .onConflictDoNothing();
    const res = await app.request(`/api/tickets/${venta.id}`);
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as { venta: Venta; config: Record<string, unknown> };
    expect(cuerpo.venta).toEqual(venta);
    expect(Object.keys(cuerpo.config).sort()).toEqual(['negocio', 'ticket', 'ventas', 'zonaHoraria']);
  });

  test('un id que no existe → 404', async () => {
    expect((await app.request(`/api/tickets/${crypto.randomUUID()}`)).status).toBe(404);
  });
});
