import { useState } from 'react';
import { clasesEntrada } from '@/componentes/Campo';
import { TecladoNumerico, aplicarTecla } from '@/componentes/TecladoNumerico';
import { DENOMINACIONES } from '@/dominio/caja';
import { formatearDinero } from '@/dominio/dinero';

/** Conteo de efectivo por denominaciones: piezas por fila (a mano o con el teclado) y subtotal. */
export function ConteoPorDenominaciones({
  conteo,
  alCambiar,
}: {
  conteo: Record<string, number>;
  alCambiar: (conteo: Record<string, number>) => void;
}) {
  const [fila, setFila] = useState(DENOMINACIONES[0]!.clave);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <table className="w-full">
        <thead>
          <tr className="text-left text-etiqueta text-grafito-suave">
            <th className="py-2 font-normal">Denominación</th>
            <th className="py-2 text-right font-normal">Piezas</th>
            <th className="py-2 text-right font-normal">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {DENOMINACIONES.map((d) => {
            const piezas = conteo[d.clave] ?? 0;
            return (
              <tr
                key={d.clave}
                onClick={() => setFila(d.clave)}
                className={`cursor-pointer border-t border-linea ${fila === d.clave ? 'bg-acero' : ''}`}
              >
                <td className="py-1">
                  <button
                    type="button"
                    className="min-h-11 w-full text-left"
                    onClick={() => setFila(d.clave)}
                  >
                    {d.nombre}
                  </button>
                </td>
                <td className="py-1 text-right">
                  <input
                    aria-label={`Piezas de ${d.nombre}`}
                    inputMode="numeric"
                    className={`${clasesEntrada} cifras w-24 text-right ${fila === d.clave ? 'border-grafito' : ''}`}
                    value={piezas || ''}
                    placeholder="0"
                    onFocus={() => setFila(d.clave)}
                    onChange={(e) =>
                      alCambiar({
                        ...conteo,
                        [d.clave]: Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0,
                      })
                    }
                  />
                </td>
                <td className="cifras py-1 text-right">{formatearDinero(d.valor * piezas)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-col gap-3 xl:sticky xl:top-0 xl:self-start">
        <p className="text-grafito-suave">
          {DENOMINACIONES.find((d) => d.clave === fila)?.nombre}: {conteo[fila] ?? 0} piezas
        </p>
        <TecladoNumerico
          alTecla={(t) => {
            const texto = aplicarTecla(String(conteo[fila] || ''), t === '00' ? '0' : t);
            alCambiar({ ...conteo, [fila]: Number(texto) || 0 });
          }}
        />
      </div>
    </div>
  );
}
