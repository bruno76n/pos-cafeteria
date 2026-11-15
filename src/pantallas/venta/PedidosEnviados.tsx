import { Ban, Printer } from 'lucide-react';
import { Boton } from '@/componentes/Boton';
import { etiquetaComanda } from '@/dominio/cuentas';
import { formatearDinero } from '@/dominio/dinero';
import { formatearHora } from '@/dominio/fechas';
import { detalleLinea, nombreLinea } from '@/dominio/personalizacion';
import type { LineaVenta, Pedido } from '@/dominio/tipos';

/**
 * Lo que ya se mandó a cocina, en solo lectura y agrupado por comanda. Las líneas son las vigentes
 * (pedidos menos anulaciones); cada anulación aparece como su propio renglón.
 */
export function PedidosEnviados({
  pedidos,
  lineas,
  zona,
  alAnular,
  alImprimir,
  imprimiendo,
}: {
  pedidos: Pedido[];
  /** Líneas vigentes de la cuenta, cada una con el número de su comanda. */
  lineas: LineaVenta[];
  zona: string;
  alAnular: (linea: LineaVenta) => void;
  alImprimir: (pedido: Pedido) => void;
  imprimiendo: boolean;
}) {
  return (
    <ul aria-label="Enviado a cocina">
      {pedidos.map((pedido) => {
        const suyas = lineas.filter((l) => l.comanda === pedido.numero);
        const hora = formatearHora(pedido.fecha, zona);
        if (pedido.tipo === 'anulacion') {
          return (
            <li key={pedido.id} className="border-b border-linea bg-faltante/5 px-4 py-2 text-etiqueta">
              <p className="font-semibold text-faltante">
                {etiquetaComanda(pedido.numero)} · anulación · {hora}
              </p>
              {pedido.lineas.map((l) => (
                <p key={l.id} className="text-grafito-suave line-through">
                  {l.cantidad} {nombreLinea(l)}
                </p>
              ))}
              <Boton
                variante="fantasma"
                className="min-h-9 px-2 text-etiqueta"
                aria-label={`Imprimir ${etiquetaComanda(pedido.numero).toLowerCase()}`}
                disabled={imprimiendo}
                onClick={() => alImprimir(pedido)}
              >
                <Printer aria-hidden size={16} /> Imprimir aviso
              </Boton>
            </li>
          );
        }
        if (suyas.length === 0) return null;
        return (
          <li key={pedido.id} className="border-b border-linea">
            <div className="flex items-center gap-2 bg-acero px-4 py-1.5">
              <p className="flex-1 text-etiqueta font-semibold text-grafito-suave">
                {etiquetaComanda(pedido.numero)} · {hora}
              </p>
              <Boton
                variante="fantasma"
                className="min-h-9 px-2 text-etiqueta"
                aria-label={`Imprimir ${etiquetaComanda(pedido.numero).toLowerCase()}`}
                disabled={imprimiendo}
                onClick={() => alImprimir(pedido)}
              >
                <Printer aria-hidden size={16} /> Imprimir
              </Boton>
            </div>
            <ul>
              {suyas.map((l) => (
                <LineaEnviada key={l.id} linea={l} alAnular={() => alAnular(l)} />
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function LineaEnviada({ linea, alAnular }: { linea: LineaVenta; alAnular: () => void }) {
  const nombre = nombreLinea(linea);
  const resumen = detalleLinea(linea);
  return (
    <li className="flex items-start gap-2 px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="cifras w-6 shrink-0 text-right font-semibold">{linea.cantidad}</span>
          <span className="min-w-0 flex-1 font-semibold">{nombre}</span>
          <span className="cifras text-grafito-suave">{formatearDinero(linea.importe)}</span>
        </div>
        <div className="ml-9 flex flex-col text-etiqueta text-grafito-suave">
          {resumen && <span>{resumen}</span>}
          {linea.nota && <span>Nota: {linea.nota}</span>}
        </div>
      </div>
      <Boton
        variante="fantasma"
        className="min-h-10 px-2 text-etiqueta text-faltante"
        aria-label={`Anular ${nombre}`}
        onClick={alAnular}
      >
        <Ban aria-hidden size={16} /> Anular
      </Boton>
    </li>
  );
}
