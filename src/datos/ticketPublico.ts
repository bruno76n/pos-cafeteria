import { useEffect, useState } from 'react';
import { api, ErrorApi, type TicketPublico } from './api';

type Estado =
  { tipo: 'cargando' } | { tipo: 'listo'; ticket: TicketPublico } | { tipo: 'error'; mensaje: string };

/** Ticket digital de una venta (página pública del QR; no usa la base local ni sesión). */
export function useTicketPublico(ventaId: string | undefined): Estado {
  const [estado, setEstado] = useState<{ id: string; estado: Estado } | null>(null);
  useEffect(() => {
    if (!ventaId) return;
    let vigente = true;
    api.ticketPublico(ventaId).then(
      (ticket) => vigente && setEstado({ id: ventaId, estado: { tipo: 'listo', ticket } }),
      (e) =>
        vigente &&
        setEstado({
          id: ventaId,
          estado: {
            tipo: 'error',
            mensaje:
              e instanceof ErrorApi && e.tipo === 'red'
                ? 'Sin conexión. Vuelve a intentar en un momento.'
                : 'No encontramos este ticket.',
          },
        }),
    );
    return () => {
      vigente = false;
    };
  }, [ventaId]);
  return estado && estado.id === ventaId ? estado.estado : { tipo: 'cargando' };
}
