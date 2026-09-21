import type { UltimaVenta } from '@/datos/bd';
import { formatearDinero } from '@/dominio/dinero';

/** Resultado de la última venta en el carrito vacío: folio y cambio en grande. */
export function ResultadoVenta({ venta }: { venta: UltimaVenta }) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center" role="status">
      <p className="text-seccion font-semibold">Venta {venta.folio}</p>
      <p className="text-grafito-suave">Cambio</p>
      <p className="cifras text-cambio leading-none font-extrabold">{formatearDinero(venta.cambio)}</p>
    </div>
  );
}
