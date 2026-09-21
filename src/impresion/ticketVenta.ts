import type { ConfigGeneral, Venta } from '@/dominio/tipos';
import { construirTicketVenta } from './ticket';

/** Enlace público al ticket digital (lo sirve GET /api/tickets/:id). */
export const urlTicketPublico = (ventaId: string) => `${window.location.origin}/t/${ventaId}`;

/** Ticket de una venta con el QR al ticket digital si la configuración lo pide. */
export function ticketDeVenta(venta: Venta, config: ConfigGeneral, opciones: { reimpresion?: boolean } = {}) {
  const qr = config.ticket.mostrarQR ? urlTicketPublico(venta.id) : undefined;
  return construirTicketVenta(venta, config, { ...opciones, qr });
}
