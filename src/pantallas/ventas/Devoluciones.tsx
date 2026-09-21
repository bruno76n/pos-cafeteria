import { useState } from 'react';
import { Link } from 'react-router';
import { Pantalla } from '@/componentes/Pantalla';
import { rangoInicial, SelectorRango, type EleccionRango } from '@/componentes/SelectorRango';
import { useDatosDelRango } from '@/datos/consultas';
import { NOMBRE_METODO } from '@/dominio/cobro';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';

/** Devoluciones por fecha, con enlace a la venta original. */
export function Devoluciones() {
  const [rango, setRango] = useState<EleccionRango>(rangoInicial);
  const datos = useDatosDelRango(rango.rango);
  if (!datos) return null;
  const devoluciones = [...datos.devoluciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = devoluciones.reduce((s, d) => s + d.monto, 0);

  return (
    <Pantalla titulo="Devoluciones">
      <SelectorRango valor={rango} alCambiar={setRango} maximoDias={35} />
      {devoluciones.length === 0 ? (
        <p className="p-8 text-center text-grafito-suave">No hay devoluciones en estas fechas.</p>
      ) : (
        <div className="overflow-x-auto rounded-hoja bg-papel">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-linea text-left text-etiqueta text-grafito-suave">
                <th className="px-4 py-3 font-normal">Fecha</th>
                <th className="px-4 py-3 font-normal">Venta</th>
                <th className="px-4 py-3 font-normal">Motivo</th>
                <th className="px-4 py-3 font-normal">Reembolso en</th>
                <th className="px-4 py-3 font-normal">Usuario</th>
                <th className="px-4 py-3 text-right font-normal">Monto</th>
              </tr>
            </thead>
            <tbody>
              {devoluciones.map((d) => (
                <tr key={d.id} className="h-14 border-b border-linea">
                  <td className="cifras px-4 text-grafito-suave">{formatearFechaHora(d.fecha)}</td>
                  <td className="px-4">
                    <Link
                      to={`/ventas/${d.ventaId}`}
                      className="cifras font-semibold underline underline-offset-4"
                    >
                      {d.folioVenta}
                    </Link>
                  </td>
                  <td className="max-w-64 truncate px-4">{d.motivo}</td>
                  <td className="px-4">{NOMBRE_METODO[d.metodo]}</td>
                  <td className="px-4 text-grafito-suave">{d.usuario.nombre}</td>
                  <td className="cifras px-4 text-right font-semibold">{formatearDinero(d.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-4 py-3 font-semibold">
                  Total ({devoluciones.length})
                </td>
                <td className="cifras px-4 py-3 text-right font-bold">{formatearDinero(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Pantalla>
  );
}
