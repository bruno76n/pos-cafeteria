import { useCategorias, useProductos, useVentaReciente } from '@/datos/consultas';
import { useConfigImpresora } from '@/datos/impresora';
import type { ConfigGeneral } from '@/dominio/tipos';
import { columnasDeImpresora } from '@/impresion/configImpresora';
import { VistaTicket } from '@/impresion/html';
import { ticketDeVenta } from '@/impresion/ticketVenta';
import { ventaDeMuestra } from './muestra';

/** Vista previa en vivo del ticket con la configuración que se está editando (al ancho de la impresora de este dispositivo). */
export function VistaPreviaTicket({ config }: { config: ConfigGeneral }) {
  const reciente = useVentaReciente();
  const productos = useProductos();
  const categorias = useCategorias();
  const impresora = useConfigImpresora();
  if (reciente === undefined || !productos || !categorias || !impresora) return null;
  const venta = reciente ?? ventaDeMuestra(config, productos, categorias);
  return (
    <aside className="flex flex-col gap-2 self-start" aria-label="Vista previa del ticket">
      <p className="text-etiqueta text-grafito-suave">Vista previa</p>
      <VistaTicket doc={ticketDeVenta(venta, config, { columnas: columnasDeImpresora(impresora) })} />
    </aside>
  );
}
