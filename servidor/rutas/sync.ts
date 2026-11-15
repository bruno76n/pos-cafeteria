import { and, asc, eq, gt, gte, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { esquemaPeticionPush, TABLAS_SYNC } from '../../src/dominio/esquemas.js';
import { DIAS_LOCALES, diaLocal, sumarDias } from '../../src/dominio/fechas.js';
import { evaluarOperacion, TABLAS_BORRABLES, TABLAS_CON_ALCANCE } from '../../src/dominio/reglasServidor.js';
import type { FilaPull, Operacion, ResultadoOperacion, TablaSync } from '../../src/dominio/tipos.js';
import type { BaseDatos } from '../db/cliente.js';
import type { categorias } from '../db/esquema.js';
import { cuentasVenta, operacionesAplicadas, pedidos, TABLAS, turnos, ventas } from '../db/esquema.js';
import { aFila, aRegistro } from '../db/registros.js';

/** Todas las tablas sincronizables tienen id, rev y actualizadoEn; para consultas genéricas. */
type TablaGenerica = typeof categorias;
const tablaDe = (nombre: TablaSync) => TABLAS[nombre] as unknown as TablaGenerica;
const siguienteRev = sql`nextval('rev_global')`;

export const FILAS_POR_PAGINA = 500;

function esValorRepetido(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return (e.cause?.code ?? e.code) === '23505';
}

/** Una venta puede chocar por su folio (otro dispositivo con el mismo prefijo) o por su cuenta (doble cobro). */
async function motivoDeRepetido(db: BaseDatos, op: Operacion): Promise<string> {
  const cuentaId = typeof op.datos.cuentaId === 'string' ? op.datos.cuentaId : null;
  if (op.tabla === 'ventas' && cuentaId) {
    const [otra] = await db
      .select({ id: ventas.id })
      .from(ventas)
      .where(and(eq(ventas.cuentaId, cuentaId), ne(ventas.id, op.registroId)));
    if (otra) return 'Esta cuenta ya se cobró en otro dispositivo.';
  }
  return `El folio ${String(op.datos.folio ?? '')} ya existe en otro dispositivo. Revisa el prefijo de folio.`;
}

/** Aplica una operación con una sola sentencia idempotente (sin transacciones interactivas). */
export async function aplicarOperacion(db: BaseDatos, op: Operacion): Promise<ResultadoOperacion> {
  const [previa] = await db
    .select({ id: operacionesAplicadas.id })
    .from(operacionesAplicadas)
    .where(eq(operacionesAplicadas.id, op.id));
  if (previa) return { id: op.id, resultado: 'duplicada' };

  const evaluacion = evaluarOperacion(op);
  if (!evaluacion.ok) return { id: op.id, resultado: 'rechazada', motivo: evaluacion.motivo };
  const { accion } = evaluacion;
  const t = tablaDe(op.tabla);

  let cambio: { id: string }[];
  try {
    switch (accion.tipo) {
      case 'insertar':
        cambio = await db
          .insert(t)
          .values(aFila(accion.valores) as never)
          .onConflictDoNothing({ target: t.id })
          .returning({ id: t.id });
        break;
      case 'upsert': {
        const { id: _id, ...campos } = aFila(accion.valores);
        cambio = await db
          .insert(t)
          .values(aFila(accion.valores) as never)
          .onConflictDoUpdate({
            target: t.id,
            set: {
              ...campos,
              ...(TABLAS_BORRABLES.includes(op.tabla) ? { borrado: false } : {}),
              rev: siguienteRev,
            } as never,
            setWhere: sql`${t.actualizadoEn} <= excluded.actualizado_en`,
          })
          .returning({ id: t.id });
        break;
      }
      case 'actualizar': {
        const condiciones: SQL[] = [eq(t.id, op.registroId)];
        if (accion.soloAbierto) {
          condiciones.push(
            op.tabla === 'turnos' ? eq(turnos.estado, 'abierto') : eq(cuentasVenta.estado, 'abierta'),
          );
        }
        cambio = await db
          .update(t)
          .set({ ...aFila(accion.valores), rev: siguienteRev } as never)
          .where(and(...condiciones))
          .returning({ id: t.id });
        if (cambio.length === 0) {
          const motivo = !accion.soloAbierto
            ? 'El registro no existe en el servidor.'
            : op.tabla === 'turnos'
              ? 'El turno no existe en el servidor o ya está cerrado.'
              : 'La cuenta no existe en el servidor o ya no está abierta.';
          return { id: op.id, resultado: 'rechazada', motivo };
        }
        break;
      }
      case 'borrar':
        cambio = await db
          .update(t)
          .set({ borrado: true, actualizadoEn: new Date(accion.actualizadoEn), rev: siguienteRev } as never)
          .where(and(eq(t.id, op.registroId), lte(t.actualizadoEn, new Date(accion.actualizadoEn))))
          .returning({ id: t.id });
        break;
    }
  } catch (error) {
    if (esValorRepetido(error))
      return { id: op.id, resultado: 'rechazada', motivo: await motivoDeRepetido(db, op) };
    throw error;
  }

  await db.insert(operacionesAplicadas).values({ id: op.id }).onConflictDoNothing();
  return { id: op.id, resultado: cambio.length > 0 ? 'aplicada' : 'duplicada' };
}

/** Filas con rev mayor al cursor, de todas las tablas, en orden de rev (máximo una página). */
export async function leerCambios(
  db: BaseDatos,
  desde: number,
  opciones: { limite?: number; hoy?: string } = {},
): Promise<{ filas: FilaPull[]; rev: number; hayMas: boolean }> {
  const limite = opciones.limite ?? FILAS_POR_PAGINA;
  const diaMinimo = sumarDias(opciones.hoy ?? diaLocal(), -DIAS_LOCALES);
  const porTabla = await Promise.all(
    TABLAS_SYNC.map(async (nombre) => {
      const t = tablaDe(nombre);
      const condiciones: (SQL | undefined)[] = [gt(t.rev, desde)];
      if (TABLAS_CON_ALCANCE.includes(nombre)) {
        const conDia = TABLAS[nombre] as unknown as typeof turnos;
        condiciones.push(
          nombre === 'turnos'
            ? or(gte(turnos.dia, diaMinimo), eq(turnos.estado, 'abierto'))
            : nombre === 'cuentasVenta'
              ? or(gte(cuentasVenta.dia, diaMinimo), eq(cuentasVenta.estado, 'abierta'))
              : nombre === 'pedidos'
                ? or(
                    gte(pedidos.dia, diaMinimo),
                    inArray(
                      pedidos.cuentaId,
                      db
                        .select({ id: cuentasVenta.id })
                        .from(cuentasVenta)
                        .where(eq(cuentasVenta.estado, 'abierta')),
                    ),
                  )
                : gte(conDia.dia, diaMinimo),
        );
      }
      const filas = await db
        .select()
        .from(t)
        .where(and(...condiciones))
        .orderBy(asc(t.rev))
        .limit(limite + 1);
      return filas.map((f) => {
        const fila = f as Record<string, unknown>;
        return {
          tabla: nombre,
          rev: Number(fila.rev),
          borrado: fila.borrado === true,
          registro: aRegistro(nombre, fila),
        };
      });
    }),
  );
  const todas = porTabla.flat().sort((a, b) => a.rev - b.rev);
  const filas = todas.slice(0, limite);
  return { filas, rev: filas.at(-1)?.rev ?? desde, hayMas: todas.length > limite };
}

export function rutasSync(db: BaseDatos) {
  return new Hono()
    .post(
      '/push',
      bodyLimit({
        maxSize: 2 * 1024 * 1024,
        onError: (c) => c.json({ error: 'Lote demasiado grande.' }, 413),
      }),
      async (c) => {
        const peticion = esquemaPeticionPush.safeParse(await c.req.json().catch(() => null));
        if (!peticion.success) return c.json({ error: 'Lote de operaciones inválido.' }, 400);
        const resultados: ResultadoOperacion[] = [];
        for (const op of peticion.data.operaciones) resultados.push(await aplicarOperacion(db, op));
        return c.json({ resultados });
      },
    )
    .get('/pull', async (c) => {
      const desde = Number(c.req.query('desde') ?? 0);
      if (!Number.isSafeInteger(desde) || desde < 0) return c.json({ error: 'Cursor inválido.' }, 400);
      return c.json(await leerCambios(db, desde));
    });
}
