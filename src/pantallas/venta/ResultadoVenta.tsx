import { Printer } from 'lucide-react';
import { Boton } from '@/componentes/Boton';
import type { UltimaVenta } from '@/datos/bd';
import { useConfig, useVenta } from '@/datos/consultas';
import { formatearDinero } from '@/dominio/dinero';
import { construirTicketVenta } from '@/impresion/ticket';
import type { useImpresora } from '@/impresion/usarImpresora';

/** Resultado de la última venta en el carrito vacío: folio, cambio en grande e imprimir. */
export function ResultadoVenta({
  ultima,
  impresora,
}: {
  ultima: UltimaVenta;
  /** La misma impresora que imprimió al cobrar (para mostrar su error y reintentar). */
  impresora: ReturnType<typeof useImpresora>;
}) {
  const venta = useVenta(ultima.ventaId);
  const config = useConfig();
  const { imprimir, error, imprimiendo } = impresora;

  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      <div role="status" className="flex flex-col items-center gap-2">
        <p className="text-seccion font-semibold">Venta {ultima.folio}</p>
        <p className="text-grafito-suave">Cambio</p>
        <p className="cifras text-cambio leading-none font-extrabold">{formatearDinero(ultima.cambio)}</p>
      </div>
      {venta && config && (
        <div className="mt-4 flex w-full flex-col gap-2">
          <Boton
            tamano="grande"
            disabled={imprimiendo}
            onClick={() => imprimir(construirTicketVenta(venta, config))}
          >
            <Printer aria-hidden /> {error ? 'Reintentar' : 'Imprimir ticket'}
          </Boton>
          {error && (
            <p className="text-etiqueta text-faltante" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
