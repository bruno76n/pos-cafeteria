import { ChefHat, Printer } from 'lucide-react';
import { Boton } from '@/componentes/Boton';
import type { UltimaVenta } from '@/datos/bd';
import { useConfig, useVenta } from '@/datos/consultas';
import { formatearDinero } from '@/dominio/dinero';
import { construirComanda, opcionesComanda } from '@/impresion/comanda';
import { ticketATexto } from '@/impresion/ticket';
import { ticketDeVenta } from '@/impresion/ticketVenta';
import type { useImpresora } from '@/impresion/usarImpresora';
import { BotonCompartir } from '@/componentes/BotonCompartir';

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
  const { imprimir, error, fallo, imprimiendo, columnas } = impresora;
  const comanda =
    venta && config && opcionesComanda(config.ticket).imprimir
      ? construirComanda(venta, config, { columnas })
      : null;
  const fallaComanda = fallo?.fallidos.includes('comanda') ?? false;
  const fallaTicket = fallo?.fallidos.includes('ticket') ?? false;

  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      <div role="status" className="flex flex-col items-center gap-2">
        <p className="text-seccion font-semibold">Venta {ultima.folio}</p>
        <p className="text-grafito-suave">Cambio</p>
        <p className="cifras text-cambio leading-none font-extrabold">{formatearDinero(ultima.cambio)}</p>
      </div>
      {venta && config && (
        <div className="mt-4 flex w-full flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Boton
              tamano="grande"
              disabled={imprimiendo}
              onClick={() => imprimir(ticketDeVenta(venta, config, { columnas }))}
            >
              <Printer aria-hidden /> {fallaTicket ? 'Reintentar' : 'Imprimir ticket'}
            </Boton>
            <BotonCompartir
              titulo={`Ticket ${venta.folio}`}
              texto={ticketATexto(ticketDeVenta(venta, config, { columnas }))}
            />
            {comanda && (
              <Boton
                className="col-span-2"
                disabled={imprimiendo}
                onClick={() =>
                  impresora.imprimirTrabajos([
                    { tipo: 'comanda', doc: comanda, copias: opcionesComanda(config.ticket).copias },
                  ])
                }
              >
                <ChefHat aria-hidden /> {fallaComanda ? 'Reintentar comanda' : 'Imprimir comanda'}
              </Boton>
            )}
          </div>
          {error && (
            <div className="text-etiqueta" role="alert">
              <p className="text-faltante">{error}</p>
              {fallo?.ayuda && <p className="text-grafito-suave">{fallo.ayuda}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
