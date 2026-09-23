import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { id as esquemaId } from '../../src/dominio/esquemas.js';
import type { BaseDatos } from '../db/cliente.js';
import { config, ventas } from '../db/esquema.js';
import { aRegistro } from '../db/registros.js';

/**
 * Ticket digital público (enlace del QR): sin token, solo devuelve la venta pedida por su id
 * (UUID imposible de adivinar) y los datos del negocio necesarios para dibujar el ticket.
 */
export function rutasTickets(db: BaseDatos) {
  return new Hono().get('/:id', async (c) => {
    const id = esquemaId.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Ticket no encontrado.' }, 404);
    const [venta] = await db.select().from(ventas).where(eq(ventas.id, id.data));
    const [general] = await db.select().from(config).where(eq(config.id, 'general'));
    if (!venta || !general) return c.json({ error: 'Ticket no encontrado.' }, 404);
    const { negocio, ticket, ventas: impuestos, zonaHoraria } = general.datos;
    return c.json({
      venta: aRegistro('ventas', venta),
      config: { negocio, ticket, ventas: impuestos, zonaHoraria },
    });
  });
}
