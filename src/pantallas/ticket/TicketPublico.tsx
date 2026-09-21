import { useParams } from 'react-router';
import { useTicketPublico } from '@/datos/ticketPublico';
import { VistaTicket } from '@/impresion/html';
import { construirTicketVenta } from '@/impresion/ticket';

/** Ticket digital que ve el cliente al escanear el QR (sin sesión). */
export function TicketPublico() {
  const { id } = useParams();
  const estado = useTicketPublico(id);
  return (
    <main className="flex min-h-full flex-col items-center gap-4 overflow-y-auto p-4">
      {estado.tipo === 'cargando' && <p className="text-grafito-suave">Cargando ticket…</p>}
      {estado.tipo === 'error' && <p className="text-seccion">{estado.mensaje}</p>}
      {estado.tipo === 'listo' && (
        <>
          <h1 className="text-seccion font-semibold">Ticket {estado.ticket.venta.folio}</h1>
          <VistaTicket doc={construirTicketVenta(estado.ticket.venta, estado.ticket.config)} />
        </>
      )}
    </main>
  );
}
