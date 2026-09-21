import { and, gte, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { dia } from '../../src/dominio/esquemas';
import { diasEntre } from '../../src/dominio/fechas';
import type { BaseDatos } from '../db/cliente';
import { devoluciones, movimientos, turnos, ventas } from '../db/esquema';
import { aRegistro } from '../db/registros';

export const MAXIMO_DIAS_REPORTE = 92;

const esquemaRango = z
  .object({ desde: dia, hasta: dia })
  .refine((r) => diasEntre(r.desde, r.hasta) >= 0, 'El rango está al revés.')
  .refine(
    (r) => diasEntre(r.desde, r.hasta) < MAXIMO_DIAS_REPORTE,
    `El rango máximo es de ${MAXIMO_DIAS_REPORTE} días.`,
  );

/** Filas de un rango de días para que la app calcule los reportes con las mismas funciones puras. */
export function rutasReportes(db: BaseDatos) {
  return new Hono().get('/', async (c) => {
    const rango = esquemaRango.safeParse({ desde: c.req.query('desde'), hasta: c.req.query('hasta') });
    if (!rango.success) return c.json({ error: rango.error.issues[0]?.message ?? 'Rango inválido.' }, 400);
    const { desde, hasta } = rango.data;
    const [v, m, d, t] = await Promise.all([
      db
        .select()
        .from(ventas)
        .where(and(gte(ventas.dia, desde), lte(ventas.dia, hasta))),
      db
        .select()
        .from(movimientos)
        .where(and(gte(movimientos.dia, desde), lte(movimientos.dia, hasta))),
      db
        .select()
        .from(devoluciones)
        .where(and(gte(devoluciones.dia, desde), lte(devoluciones.dia, hasta))),
      db
        .select()
        .from(turnos)
        .where(and(gte(turnos.dia, desde), lte(turnos.dia, hasta))),
    ]);
    return c.json({
      ventas: v.map((f) => aRegistro('ventas', f)),
      movimientos: m.map((f) => aRegistro('movimientos', f)),
      devoluciones: d.map((f) => aRegistro('devoluciones', f)),
      turnos: t.map((f) => aRegistro('turnos', f)),
    });
  });
}
