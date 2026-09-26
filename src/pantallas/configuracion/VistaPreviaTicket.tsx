import { useCategorias, useProductos, useVentaReciente } from '@/datos/consultas';
import { useConfigImpresora } from '@/datos/impresora';
import type { ConfigGeneral } from '@/dominio/tipos';
import { construirComanda, opcionesComanda } from '@/impresion/comanda';
import { columnasDeImpresora } from '@/impresion/configImpresora';
import { VistaTicket } from '@/impresion/html';
import { ticketDeVenta } from '@/impresion/ticketVenta';
import { ventaDeMuestra } from './muestra';

/**
 * Vista previa en vivo del ticket del cliente (y de la comanda de cocina en Ticket) con la configuración que se
 * está editando (al ancho de la impresora de este dispositivo).
 */
export function VistaPreviaTicket({
  config,
  conComanda = false,
}: {
  config: ConfigGeneral;
  /** Solo en Configuración › Ticket, donde se configura la comanda. */
  conComanda?: boolean;
}) {
  const reciente = useVentaReciente();
  const productos = useProductos();
  const categorias = useCategorias();
  const impresora = useConfigImpresora();
  if (reciente === undefined || !productos || !categorias || !impresora) return null;
  const venta = reciente ?? ventaDeMuestra(config, productos, categorias);
  const columnas = columnasDeImpresora(impresora);
  const mostrarComanda = conComanda && opcionesComanda(config.ticket).imprimir;
  const comanda = mostrarComanda ? construirComanda(venta, config, { columnas }) : null;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <aside className="flex flex-col gap-2" aria-label="Vista previa del ticket">
        <p className="text-etiqueta text-grafito-suave">
          {mostrarComanda ? 'Ticket del cliente' : 'Vista previa'}
        </p>
        <VistaTicket doc={ticketDeVenta(venta, config, { columnas })} />
      </aside>
      {mostrarComanda && (
        <aside className="flex flex-col gap-2" aria-label="Vista previa de la comanda de cocina">
          <p className="text-etiqueta text-grafito-suave">Comanda de cocina</p>
          {comanda ? (
            <VistaTicket doc={comanda} etiqueta="Vista previa de la comanda" />
          ) : (
            <p className="max-w-[32ch] text-grafito-suave">
              Esta venta no tiene productos que vayan a cocina.
            </p>
          )}
        </aside>
      )}
    </div>
  );
}
