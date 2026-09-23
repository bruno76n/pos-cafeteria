import { beforeEach, describe, expect, test } from 'vitest';
import { categoriaPrueba, categoriasPrueba, ventaPrueba } from '@/dominio/datosPrueba';
import { diaLocal, sumarDias } from '@/dominio/fechas';
import type { FilaPull, Operacion, RespuestaPull, RespuestaPush } from '@/dominio/tipos';
import { ErrorApi, type ClienteApi } from './api';
import { bd, guardarMeta, leerMeta } from './bd';
import { crear } from './escrituras';
import { describirError, reintentarErrorSync } from './erroresSync';
import { useEstadoSync } from './estadoSync';
import { ESPERAS_MS, MotorSync } from './sync';

/** Servidor simulado: registra lo recibido y responde según el escenario. */
class ServidorSimulado implements ClienteApi {
  lotes: Operacion[][] = [];
  falla: ErrorApi | null = null;
  respuesta: (op: Operacion) => RespuestaPush['resultados'][number] = (op) => ({
    id: op.id,
    resultado: 'aplicada',
  });
  paginas: RespuestaPull[] = [];
  pullsPedidos: number[] = [];

  async push(_token: string, operaciones: Operacion[]): Promise<RespuestaPush> {
    if (this.falla) throw this.falla;
    this.lotes.push(operaciones);
    return { resultados: operaciones.map((op) => this.respuesta(op)) };
  }

  async pull(_token: string, desde: number): Promise<RespuestaPull> {
    if (this.falla) throw this.falla;
    this.pullsPedidos.push(desde);
    return this.paginas.shift() ?? { filas: [], rev: desde, hayMas: false };
  }
}

let servidor: ServidorSimulado;
let reloj: number;
let motor: MotorSync;

beforeEach(async () => {
  await Promise.all(bd.tables.map((t) => t.clear()));
  await guardarMeta('sesion', { token: 't', cuenta: { id: 'c', correo: 'caja@demo.test' }, expirada: false });
  servidor = new ServidorSimulado();
  reloj = 1_000_000;
  motor = new MotorSync(servidor, () => reloj);
});

async function crearCategorias(n: number) {
  for (let i = 0; i < n; i++) {
    const { actualizadoEn: _, ...c } = categoriaPrueba('cafes');
    await crear('categorias', { ...c, id: `c${i}`, orden: i });
  }
}

describe('push', () => {
  test('sube en orden de creación y vacía la outbox', async () => {
    await crearCategorias(3);
    expect(await motor.push()).toBe('ok');
    expect(servidor.lotes).toHaveLength(1);
    expect(servidor.lotes[0]!.map((o) => o.registroId)).toEqual(['c0', 'c1', 'c2']);
    expect(servidor.lotes[0]![0]).not.toHaveProperty('intentos');
    expect(await bd.outbox.count()).toBe(0);
    expect(useEstadoSync.getState().enLinea).toBe(true);
  });

  test('lotes de hasta 100', async () => {
    await crearCategorias(150);
    await motor.push();
    expect(servidor.lotes.map((l) => l.length)).toEqual([100, 50]);
    expect(servidor.lotes[1]![0]!.registroId).toBe('c100');
  });

  test('red caída: no pierde nada y espera cada vez más', async () => {
    await crearCategorias(2);
    servidor.falla = new ErrorApi('red', 'Sin conexión con el servidor.');
    expect(await motor.push()).toBe('error-red');
    expect(await bd.outbox.count()).toBe(2);
    expect((await bd.outbox.toArray())[0]).toMatchObject({
      intentos: 1,
      ultimoError: 'Sin conexión con el servidor.',
    });
    expect(motor.esperaMs).toBe(ESPERAS_MS[0]);
    expect(useEstadoSync.getState().enLinea).toBe(false);

    // antes de la espera no reintenta
    expect(await motor.push()).toBe('en-espera');
    const esperas: number[] = [motor.esperaMs];
    for (let i = 0; i < 4; i++) {
      reloj += motor.esperaMs;
      await motor.push();
      esperas.push(motor.esperaMs);
    }
    expect(esperas).toEqual([5_000, 15_000, 30_000, 60_000, 60_000]);

    servidor.falla = null;
    reloj += 60_000;
    expect(await motor.push()).toBe('ok');
    expect(await bd.outbox.count()).toBe(0);
    expect(motor.esperaMs).toBe(0);
  });

  test('5xx se trata como error de red', async () => {
    await crearCategorias(1);
    servidor.falla = new ErrorApi('red', 'Error del servidor.', 500);
    expect(await motor.push()).toBe('error-red');
    expect(await bd.outbox.count()).toBe(1);
  });

  test('401: marca la sesión como expirada sin borrar la outbox', async () => {
    await crearCategorias(2);
    servidor.falla = new ErrorApi('sesion', 'Sesión inválida o expirada.', 401);
    expect(await motor.push()).toBe('sesion-expirada');
    expect(await bd.outbox.count()).toBe(2);
    expect((await leerMeta('sesion'))?.expirada).toBe(true);
    expect(await motor.push()).toBe('sesion-expirada');

    // al volver a iniciar sesión se sigue subiendo
    servidor.falla = null;
    await guardarMeta('sesion', {
      token: 'nuevo',
      cuenta: { id: 'c', correo: 'caja@demo.test' },
      expirada: false,
    });
    expect(await motor.push()).toBe('ok');
    expect(await bd.outbox.count()).toBe(0);
  });

  test('rechazada pasa a erroresSync y no bloquea la cola', async () => {
    await crearCategorias(3);
    servidor.respuesta = (op) =>
      op.registroId === 'c1'
        ? { id: op.id, resultado: 'rechazada', motivo: 'Dato inválido' }
        : { id: op.id, resultado: 'aplicada' };
    await motor.push();
    expect(await bd.outbox.count()).toBe(0);
    const errores = await bd.erroresSync.toArray();
    expect(errores).toHaveLength(1);
    expect(errores[0]).toMatchObject({ registroId: 'c1', tabla: 'categorias', motivo: 'Dato inválido' });
  });

  test('duplicada cuenta como éxito', async () => {
    await crearCategorias(1);
    servidor.respuesta = (op) => ({ id: op.id, resultado: 'duplicada' });
    await motor.push();
    expect(await bd.outbox.count()).toBe(0);
    expect(await bd.erroresSync.count()).toBe(0);
  });

  test('una operación sin respuesta se queda para el siguiente intento', async () => {
    await crearCategorias(2);
    let primera = true;
    servidor.respuesta = (op) => {
      const r = { id: primera ? op.id : 'otro', resultado: 'aplicada' as const };
      primera = false;
      return r;
    };
    expect(await motor.push()).toBe('error-red');
    expect((await bd.outbox.toArray()).map((o) => o.registroId)).toEqual(['c1']);
  });

  test('lotes por tamaño: nunca más de ~1.5 MB por petición', async () => {
    const imagen = `data:image/webp;base64,${'A'.repeat(70_000)}`;
    for (let i = 0; i < 50; i++) {
      await crear('productos', {
        id: `p${i}`,
        nombre: `P${i}`,
        descripcion: '',
        categoriaId: 'c',
        precio: 100,
        imagen,
        disponible: true,
        orden: i,
        gruposIds: [],
        tamanos: [],
        armado: null,
      });
    }
    await motor.push();
    expect(servidor.lotes.length).toBeGreaterThan(2);
    expect(servidor.lotes.every((l) => JSON.stringify(l).length < 2 * 1024 * 1024)).toBe(true);
    expect(servidor.lotes.flat().map((o) => o.registroId)).toEqual(
      Array.from({ length: 50 }, (_, i) => `p${i}`),
    );
  });

  test('un lote que el servidor no acepta (400/413) se manda una por una y solo se aparta la mala', async () => {
    await crearCategorias(3);
    const push = servidor.push.bind(servidor);
    servidor.push = async (token, operaciones) => {
      if (operaciones.some((o) => o.registroId === 'c1'))
        throw new ErrorApi('peticion', 'Lote de operaciones inválido.', 400);
      return push(token, operaciones);
    };
    expect(await motor.push()).toBe('ok');
    expect(await bd.outbox.count()).toBe(0);
    expect(servidor.lotes.flat().map((o) => o.registroId)).toEqual(['c0', 'c2']);
    expect(await bd.erroresSync.toArray()).toEqual([
      expect.objectContaining({ registroId: 'c1', motivo: 'Lote de operaciones inválido.' }),
    ]);
  });

  test('solo un push a la vez', async () => {
    await crearCategorias(1);
    const [a, b] = await Promise.all([motor.push(), motor.push()]);
    expect([a, b]).toEqual(['ok', 'ok']);
    expect(servidor.lotes).toHaveLength(1);
  });

  test('sin sesión no sube nada', async () => {
    await bd.meta.delete('sesion');
    await crearCategorias(1);
    expect(await motor.push()).toBe('sin-sesion');
    expect(servidor.lotes).toHaveLength(0);
  });
});

describe('pull', () => {
  const fila = (
    tabla: FilaPull['tabla'],
    registro: Record<string, unknown>,
    rev: number,
    borrado = false,
  ): FilaPull => ({
    tabla,
    rev,
    borrado,
    registro,
  });

  test('aplica páginas hasta vaciar y guarda el cursor', async () => {
    const [a, b] = categoriasPrueba;
    servidor.paginas = [
      { filas: [fila('categorias', a!, 1)], rev: 1, hayMas: true },
      { filas: [fila('categorias', b!, 2)], rev: 2, hayMas: false },
    ];
    expect(await motor.pull()).toBe('ok');
    expect(servidor.pullsPedidos).toEqual([0, 1]);
    expect(await leerMeta('cursorPull')).toBe(2);
    expect(await leerMeta('primerPullCompleto')).toBe(true);
    expect((await bd.categorias.toArray()).map((c) => c.id).sort()).toEqual([a!.id, b!.id].sort());
  });

  test('no pisa registros con operaciones pendientes', async () => {
    const { actualizadoEn: _, ...cafes } = categoriaPrueba('cafes');
    await crear('categorias', { ...cafes, nombre: 'Local' });
    servidor.paginas = [
      { filas: [fila('categorias', { ...cafes, nombre: 'Servidor' }, 5)], rev: 5, hayMas: false },
    ];
    await motor.pull();
    expect((await bd.categorias.get(cafes.id))?.nombre).toBe('Local');
    expect(await leerMeta('cursorPull')).toBe(5);
  });

  test('borra lo que llega como lápida', async () => {
    const cafes = categoriaPrueba('cafes');
    await bd.categorias.put(cafes);
    servidor.paginas = [{ filas: [fila('categorias', { id: cafes.id }, 7, true)], rev: 7, hayMas: false }];
    await motor.pull();
    expect(await bd.categorias.get(cafes.id)).toBeUndefined();
  });

  test('el contador de folios de este dispositivo nunca retrocede', async () => {
    await guardarMeta('dispositivoId', 'caja-1');
    const disp = {
      id: 'caja-1',
      nombre: 'Caja 1',
      tipo: 'caja',
      prefijo: 'A',
      ultimoFolio: 50,
      activo: true,
      actualizadoEn: '2026-09-19T00:00:00.000Z',
    };
    await bd.dispositivos.put(disp as never);
    servidor.paginas = [
      {
        filas: [fila('dispositivos', { ...disp, ultimoFolio: 40, activo: true, nombre: 'Caja uno' }, 3)],
        rev: 3,
        hayMas: false,
      },
    ];
    await motor.pull();
    expect(await bd.dispositivos.get('caja-1')).toMatchObject({
      ultimoFolio: 50,
      activo: true,
      nombre: 'Caja uno',
    });
  });

  test('401 en el pull también expira la sesión', async () => {
    servidor.falla = new ErrorApi('sesion', 'x', 401);
    expect(await motor.pull()).toBe('sesion-expirada');
    expect((await leerMeta('sesion'))?.expirada).toBe(true);
  });

  test('sincronizar sube y luego baja', async () => {
    await crearCategorias(1);
    servidor.paginas = [{ filas: [], rev: 9, hayMas: false }];
    expect(await motor.sincronizar()).toBe('ok');
    expect(servidor.lotes).toHaveLength(1);
    expect(servidor.pullsPedidos).toEqual([0]);
  });
});

describe('limpieza diaria', () => {
  test('borra lo de hace más de 35 días que no esté pendiente, una vez al día', async () => {
    const hoy = diaLocal();
    const viejo = sumarDias(hoy, -40);
    await bd.ventas.bulkPut([
      ventaPrueba({ id: 'vieja', dia: viejo }),
      ventaPrueba({ id: 'reciente', dia: sumarDias(hoy, -3) }),
    ]);
    await crear('ventas', { ...ventaPrueba({ id: 'vieja-pendiente', folio: 'A-000999', dia: viejo }) });
    await bd.turnos.bulkPut([
      { id: 't-cerrado', dia: viejo, estado: 'cerrado' } as never,
      { id: 't-abierto', dia: viejo, estado: 'abierto' } as never,
    ]);
    expect(await motor.limpiarAntiguos(hoy)).toBe(2);
    expect((await bd.ventas.toArray()).map((v) => v.id).sort()).toEqual(['reciente', 'vieja-pendiente']);
    expect((await bd.turnos.toArray()).map((t) => t.id)).toEqual(['t-abierto']);
    await bd.ventas.put(ventaPrueba({ id: 'otra-vieja', dia: viejo }));
    expect(await motor.limpiarAntiguos(hoy)).toBe(0);
  });
});

describe('errores de sincronización', () => {
  test('reintentar regresa la operación a la cola y la sube', async () => {
    await crearCategorias(1);
    servidor.respuesta = (op) => ({ id: op.id, resultado: 'rechazada', motivo: 'No' });
    await motor.push();
    const [error] = await bd.erroresSync.toArray();
    expect(describirError(error!)).toBe('La categoría «Cafés»');
    servidor.respuesta = (op) => ({ id: op.id, resultado: 'aplicada' });
    await reintentarErrorSync(error!.id, motor);
    expect(await bd.erroresSync.count()).toBe(0);
    expect(await bd.outbox.count()).toBe(0);
    expect(servidor.lotes.at(-1)![0]!.id).toBe(error!.id);
  });

  test('describe ventas por folio', () => {
    expect(describirError({ tabla: 'ventas', registroId: 'v', datos: { folio: 'A-000123' } })).toBe(
      'La venta A-000123',
    );
  });
});
