import { useCategorias, useProductos, useVentaReciente } from '@/datos/consultas';
import type { ConfigGeneral } from '@/dominio/tipos';
import { VistaTicket } from '@/impresion/html';
import { construirTicketVenta } from '@/impresion/ticket';
import { ventaDeMuestra } from './muestra';

/** Vista previa en vivo del ticket con la configuración que se está editando. */
export function VistaPreviaTicket({ config }: { config: ConfigGeneral }) {
  const reciente = useVentaReciente();
  const productos = useProductos();
  const categorias = useCategorias();
  if (reciente === undefined || !productos || !categorias) return null;
  const venta = reciente ?? ventaDeMuestra(config, productos, categorias);
  return (
    <aside className="flex flex-col gap-2 self-start" aria-label="Vista previa del ticket">
      <p className="text-etiqueta text-grafito-suave">Vista previa</p>
      <VistaTicket doc={construirTicketVenta(venta, config)} />
    </aside>
  );
}
