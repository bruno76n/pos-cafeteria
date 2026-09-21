import { Link } from 'react-router';
import { Pantalla } from '@/componentes/Pantalla';
import { useCortes } from '@/datos/consultas';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';
import { textoDiferencia } from './diferencia';

/** Historial de cortes: fecha, dispositivo, quién abrió y cerró, total vendido y diferencia. */
export function Cortes() {
  const cortes = useCortes();
  if (!cortes) return null;
  return (
    <Pantalla titulo="Cortes de caja">
      {cortes.length === 0 ? (
        <p className="p-8 text-center text-grafito-suave">Todavía no hay cortes de caja.</p>
      ) : (
        <div className="overflow-x-auto rounded-hoja border border-linea bg-papel">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-linea text-left text-etiqueta text-grafito-suave">
                <th className="px-4 py-3 font-normal">Cierre</th>
                <th className="px-4 py-3 font-normal">Dispositivo</th>
                <th className="px-4 py-3 font-normal">Abrió / cerró</th>
                <th className="px-4 py-3 text-right font-normal">Total vendido</th>
                <th className="px-4 py-3 text-right font-normal">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((t) => {
                const dif = textoDiferencia(t.resumen?.diferencia ?? 0);
                return (
                  <tr key={t.id} className="h-14 border-b border-linea last:border-b-0 active:bg-acero">
                    <td className="px-4">
                      <Link
                        to={`/caja/cortes/${t.id}`}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {t.cerradoEn ? formatearFechaHora(t.cerradoEn) : '—'}
                      </Link>
                    </td>
                    <td className="px-4">{t.dispositivoNombre}</td>
                    <td className="px-4 text-grafito-suave">
                      {t.abiertoPor.nombre} / {t.cerradoPor?.nombre ?? '—'}
                    </td>
                    <td className="cifras px-4 text-right">
                      {formatearDinero(t.resumen?.totalVendido ?? 0)}
                    </td>
                    <td
                      className={`cifras px-4 text-right font-semibold ${dif.tono === 'faltante' ? 'text-faltante' : dif.tono === 'cafeto' ? 'text-cafeto' : ''}`}
                    >
                      {dif.texto}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Pantalla>
  );
}
