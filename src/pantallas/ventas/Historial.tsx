import { CloudUpload } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { clasesBoton } from '@/componentes/Boton';
import { clasesEntrada } from '@/componentes/Campo';
import { Insignia } from '@/componentes/Insignia';
import { Pantalla } from '@/componentes/Pantalla';
import { rangoInicial, SelectorRango, type EleccionRango } from '@/componentes/SelectorRango';
import { useDatosDelRango, usePendientes } from '@/datos/consultas';
import { NOMBRE_METODO } from '@/dominio/cobro';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFecha, formatearHora } from '@/dominio/fechas';
import {
  cajerosDe,
  filtrarVentas,
  NOMBRE_ESTADO,
  resumenProductos,
  SIN_FILTROS,
  type FiltrosVentas,
} from '@/dominio/historial';
import { ESTADOS_VENTA, METODOS_PAGO } from '@/dominio/esquemas';
import type { EstadoVenta } from '@/dominio/tipos';

export const TONO_ESTADO: Record<EstadoVenta, 'neutro' | 'faltante' | 'ambar'> = {
  pagada: 'neutro',
  cancelada: 'faltante',
  devuelta_parcial: 'ambar',
  devuelta: 'ambar',
};

export function InsigniaPorSubir() {
  return (
    <Insignia tono="ambar">
      <CloudUpload aria-hidden size={14} /> Por subir
    </Insignia>
  );
}

/** Historial de ventas (datos de la tablet) con filtros. */
export function Historial() {
  const navegar = useNavigate();
  const [rango, setRango] = useState<EleccionRango>(rangoInicial);
  const [filtros, setFiltros] = useState<FiltrosVentas>(SIN_FILTROS);
  const datos = useDatosDelRango(rango.rango);
  const pendientes = usePendientes('ventas');
  if (!datos) return null;
  const ventas = filtrarVentas(datos.ventas, filtros);
  const variosDias = rango.rango.desde !== rango.rango.hasta;
  const cambiar = (cambios: Partial<FiltrosVentas>) => setFiltros((f) => ({ ...f, ...cambios }));

  return (
    <Pantalla titulo="Historial">
      <SelectorRango valor={rango} alCambiar={setRango} maximoDias={35} />
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          aria-label="Buscar folio"
          placeholder="Folio…"
          className={`${clasesEntrada} max-w-40`}
          value={filtros.folio}
          onChange={(e) => cambiar({ folio: e.target.value })}
        />
        <select
          aria-label="Método de pago"
          className={`${clasesEntrada} max-w-48`}
          value={filtros.metodo ?? ''}
          onChange={(e) => cambiar({ metodo: (e.target.value || null) as FiltrosVentas['metodo'] })}
        >
          <option value="">Todos los métodos</option>
          {METODOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {NOMBRE_METODO[m]}
            </option>
          ))}
        </select>
        <select
          aria-label="Cajero"
          className={`${clasesEntrada} max-w-48`}
          value={filtros.cajeroId ?? ''}
          onChange={(e) => cambiar({ cajeroId: e.target.value || null })}
        >
          <option value="">Todos los cajeros</option>
          {cajerosDe(datos.ventas).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          className={`${clasesEntrada} max-w-48`}
          value={filtros.estado ?? ''}
          onChange={(e) => cambiar({ estado: (e.target.value || null) as FiltrosVentas['estado'] })}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_VENTA.map((e) => (
            <option key={e} value={e}>
              {NOMBRE_ESTADO[e]}
            </option>
          ))}
        </select>
      </div>

      {ventas.length === 0 ? (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-seccion">
            {datos.ventas.length === 0 && rango.tipo === 'hoy'
              ? 'Todavía no hay ventas hoy.'
              : 'No hay ventas con estos filtros.'}
          </p>
          {rango.tipo === 'hoy' && (
            <Link to="/venta" className={clasesBoton('oscuro', 'grande')}>
              Nueva venta
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-hoja border border-linea bg-papel">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-linea text-left text-etiqueta text-grafito-suave">
                <th className="px-4 py-3 font-normal">Folio</th>
                <th className="px-4 py-3 font-normal">{variosDias ? 'Fecha' : 'Hora'}</th>
                <th className="px-4 py-3 font-normal">Productos</th>
                <th className="px-4 py-3 text-right font-normal">Total</th>
                <th className="px-4 py-3 font-normal">Pago</th>
                <th className="px-4 py-3 font-normal">Cajero</th>
                <th className="px-4 py-3 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navegar(`/ventas/${v.id}`)}
                  className="h-14 cursor-pointer border-b border-linea last:border-b-0 active:bg-acero"
                >
                  <td className="px-4">
                    <Link
                      to={`/ventas/${v.id}`}
                      className="cifras font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {v.folio}
                    </Link>
                  </td>
                  <td className="cifras px-4 text-grafito-suave">
                    {variosDias
                      ? `${formatearFecha(v.fecha).slice(0, 5)} ${formatearHora(v.fecha)}`
                      : formatearHora(v.fecha)}
                  </td>
                  <td className="max-w-72 truncate px-4">{resumenProductos(v)}</td>
                  <td className="cifras px-4 text-right font-semibold">{formatearDinero(v.total)}</td>
                  <td className="px-4 text-grafito-suave">
                    {v.pagos.length ? v.pagos.map((p) => NOMBRE_METODO[p.metodo]).join(' + ') : '—'}
                  </td>
                  <td className="px-4 text-grafito-suave">{v.cajero.nombre}</td>
                  <td className="px-4">
                    <span className="flex flex-wrap gap-1">
                      {v.estado !== 'pagada' && (
                        <Insignia tono={TONO_ESTADO[v.estado]}>{NOMBRE_ESTADO[v.estado]}</Insignia>
                      )}
                      {pendientes?.has(v.id) && <InsigniaPorSubir />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pantalla>
  );
}
