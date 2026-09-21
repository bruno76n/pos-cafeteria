import { Download } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Boton } from '@/componentes/Boton';
import { Insignia } from '@/componentes/Insignia';
import { Pantalla } from '@/componentes/Pantalla';
import { rangoInicial, SelectorRango, type EleccionRango } from '@/componentes/SelectorRango';
import { TablaCifras } from '@/componentes/TablaCifras';
import { useDatosReporte } from '@/datos/reportes';
import { aCSV, pesosCSV, type Celda } from '@/dominio/csv';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFecha, formatearFechaHora } from '@/dominio/fechas';
import { calcularReporte, type Barra, type Reporte } from '@/dominio/reportes';
import { textoDiferencia } from '@/pantallas/caja/diferencia';

type Pestana = 'resumen' | 'productos' | 'categorias' | 'cajeros' | 'cortes';

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'productos', texto: 'Productos' },
  { id: 'categorias', texto: 'Categorías' },
  { id: 'cajeros', texto: 'Cajeros' },
  { id: 'cortes', texto: 'Cortes' },
];

interface Tabla {
  encabezados: string[];
  /** Columnas alineadas a la derecha (números). */
  numericas: number[];
  filas: { celdas: ReactNode[]; csv: Celda[]; destacada?: boolean }[];
}

function descargarCSV(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Barras({ barras, porHora }: { barras: Barra[]; porHora: boolean }) {
  const maximo = Math.max(1, ...barras.map((b) => b.importe));
  if (barras.length === 0) return <p className="text-grafito-suave">No hay ventas en estas fechas.</p>;
  return (
    <ul className="flex flex-col gap-1" aria-label={porHora ? 'Ventas por hora' : 'Ventas por día'}>
      {barras.map((b) => (
        <li key={b.etiqueta} className="grid grid-cols-[5.5rem_minmax(0,1fr)_7rem] items-center gap-3">
          <span className="cifras text-etiqueta text-grafito-suave">
            {porHora ? b.etiqueta : formatearFecha(b.etiqueta).slice(0, 5)}
          </span>
          <span className="h-5 rounded-sm bg-linea/60">
            <span
              className="block h-full rounded-sm bg-grafito"
              style={{ width: `${(b.importe / maximo) * 100}%` }}
            />
          </span>
          <span className="cifras text-right text-etiqueta">{formatearDinero(b.importe)}</span>
        </li>
      ))}
    </ul>
  );
}

function TablaReporte({ tabla }: { tabla: Tabla }) {
  if (tabla.filas.length === 0)
    return <p className="p-6 text-center text-grafito-suave">No hay datos en estas fechas.</p>;
  return (
    <div className="overflow-x-auto rounded-hoja border border-linea bg-papel">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-linea text-left text-etiqueta text-grafito-suave">
            {tabla.encabezados.map((e, i) => (
              <th
                key={e}
                className={`px-4 py-3 font-normal ${tabla.numericas.includes(i) ? 'text-right' : ''}`}
              >
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((f, i) => (
            <tr
              key={i}
              className={`h-12 border-b border-linea last:border-b-0 ${f.destacada ? 'font-semibold' : ''}`}
            >
              {f.celdas.map((c, j) => (
                <td key={j} className={`px-4 ${tabla.numericas.includes(j) ? 'cifras text-right' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tablaDe(pestana: Exclude<Pestana, 'resumen'>, r: Reporte, orden: 'importe' | 'cantidad'): Tabla {
  switch (pestana) {
    case 'productos': {
      const productos = [...r.productos].sort((a, b) =>
        orden === 'importe' ? b.importe - a.importe : b.cantidad - a.cantidad,
      );
      const top = new Set(
        [...r.productos]
          .sort((a, b) => b.importe - a.importe)
          .slice(0, 10)
          .map((p) => p.productoId),
      );
      return {
        encabezados: ['Producto', 'Categoría', 'Cantidad', 'Importe', '%'],
        numericas: [2, 3, 4],
        filas: productos.map((p) => ({
          destacada: top.has(p.productoId),
          celdas: [
            <span className="flex items-center gap-2">
              {p.nombre} {top.has(p.productoId) && <Insignia>Top 10</Insignia>}
            </span>,
            p.categoriaNombre,
            p.cantidad,
            formatearDinero(p.importe),
            `${p.porcentaje}%`,
          ],
          csv: [p.nombre, p.categoriaNombre, p.cantidad, pesosCSV(p.importe), p.porcentaje],
        })),
      };
    }
    case 'categorias':
      return {
        encabezados: ['Categoría', 'Cantidad', 'Importe', '%'],
        numericas: [1, 2, 3],
        filas: r.categorias.map((c) => ({
          celdas: [c.nombre, c.cantidad, formatearDinero(c.importe), `${c.porcentaje}%`],
          csv: [c.nombre, c.cantidad, pesosCSV(c.importe), c.porcentaje],
        })),
      };
    case 'cajeros':
      return {
        encabezados: ['Cajero', 'Ventas', 'Total', 'Ticket promedio', 'Cancelaciones'],
        numericas: [1, 2, 3, 4],
        filas: r.cajeros.map((c) => ({
          celdas: [
            c.nombre,
            c.ventas,
            formatearDinero(c.total),
            formatearDinero(c.ticketPromedio),
            c.cancelaciones,
          ],
          csv: [c.nombre, c.ventas, pesosCSV(c.total), pesosCSV(c.ticketPromedio), c.cancelaciones],
        })),
      };
    case 'cortes':
      return {
        encabezados: ['Cierre', 'Dispositivo', 'Abrió / cerró', 'Total vendido', 'Diferencia'],
        numericas: [3, 4],
        filas: r.cortes.map((t) => {
          const dif = textoDiferencia(t.resumen?.diferencia ?? 0);
          return {
            celdas: [
              t.cerradoEn ? formatearFechaHora(t.cerradoEn) : '',
              t.dispositivoNombre,
              `${t.abiertoPor.nombre} / ${t.cerradoPor?.nombre ?? ''}`,
              formatearDinero(t.resumen?.totalVendido ?? 0),
              <span
                className={
                  dif.tono === 'faltante' ? 'text-faltante' : dif.tono === 'cafeto' ? 'text-cafeto' : ''
                }
              >
                {dif.texto}
              </span>,
            ],
            csv: [
              t.cerradoEn ? formatearFechaHora(t.cerradoEn) : '',
              t.dispositivoNombre,
              `${t.abiertoPor.nombre} / ${t.cerradoPor?.nombre ?? ''}`,
              pesosCSV(t.resumen?.totalVendido ?? 0),
              pesosCSV(t.resumen?.diferencia ?? 0),
            ],
          };
        }),
      };
  }
}

function filasResumen(r: Reporte) {
  return [
    { etiqueta: 'Ventas brutas', valor: formatearDinero(r.ventasBrutas) },
    {
      etiqueta: `Cancelaciones (${r.cancelaciones.cantidad})`,
      valor: formatearDinero(-r.cancelaciones.importe),
    },
    {
      etiqueta: `Devoluciones (${r.devoluciones.cantidad})`,
      valor: formatearDinero(-r.devoluciones.importe),
    },
    { etiqueta: 'Ventas netas', valor: formatearDinero(r.ventasNetas), fuerte: true },
    { etiqueta: 'Número de ventas', valor: String(r.numeroVentas) },
    { etiqueta: 'Ticket promedio', valor: formatearDinero(r.ticketPromedio) },
    { etiqueta: 'Descuentos', valor: formatearDinero(r.descuentos) },
    { etiqueta: 'Efectivo', valor: formatearDinero(r.porMetodo.efectivo) },
    { etiqueta: 'Tarjeta', valor: formatearDinero(r.porMetodo.tarjeta) },
    { etiqueta: 'Transferencia', valor: formatearDinero(r.porMetodo.transferencia) },
    { etiqueta: 'Gastos', valor: formatearDinero(r.gastos.total) },
    ...Object.entries(r.gastos.porCategoria).map(([c, m]) => ({
      etiqueta: `  ${c}`,
      valor: formatearDinero(m),
    })),
  ];
}

/** Reportes por rango (Hoy, Ayer, Semana, Mes o Personalizado hasta 92 días) con exportación a CSV. */
export function Reportes() {
  const [rango, setRango] = useState<EleccionRango>(rangoInicial);
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [orden, setOrden] = useState<'importe' | 'cantidad'>('importe');
  const estado = useDatosReporte(rango.rango);
  const reporte = estado.tipo === 'listo' ? calcularReporte(estado.datos, rango.rango) : null;
  const sufijo = `${rango.rango.desde}_${rango.rango.hasta}`;

  function exportar() {
    if (!reporte) return;
    if (pestana === 'resumen') {
      const filas = filasResumen(reporte).map((f) => [
        String(f.etiqueta).trim(),
        f.valor.replace(/[$,]/g, ''),
      ]);
      descargarCSV(`reporte-resumen-${sufijo}.csv`, aCSV(['Concepto', 'Valor'], filas));
      return;
    }
    const tabla = tablaDe(pestana, reporte, orden);
    descargarCSV(
      `reporte-${pestana}-${sufijo}.csv`,
      aCSV(
        tabla.encabezados,
        tabla.filas.map((f) => f.csv),
      ),
    );
  }

  return (
    <Pantalla
      titulo="Reportes"
      acciones={
        <Boton onClick={exportar} disabled={!reporte}>
          <Download aria-hidden /> Exportar CSV
        </Boton>
      }
    >
      <SelectorRango valor={rango} alCambiar={setRango} />
      <div role="tablist" aria-label="Reportes" className="flex gap-1 overflow-x-auto border-b border-linea">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`min-h-12 shrink-0 border-b-3 px-4 font-semibold ${
              pestana === p.id ? 'border-grafito text-grafito' : 'border-transparent text-grafito-suave'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {estado.tipo === 'cargando' && <p className="text-grafito-suave">Cargando…</p>}
      {estado.tipo === 'error' && (
        <p className="rounded-boton bg-ambar-fondo p-3 text-ambar" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.tipo === 'listo' && estado.aviso && (
        <p className="rounded-boton bg-ambar-fondo p-3 text-ambar" role="status">
          {estado.aviso}
        </p>
      )}

      {reporte && pestana === 'resumen' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-hoja border border-linea bg-papel px-5 py-3" aria-label="Resumen">
            <TablaCifras filas={filasResumen(reporte)} />
          </section>
          <section
            className="flex flex-col gap-3 rounded-hoja border border-linea bg-papel p-5"
            aria-label="Ventas en el tiempo"
          >
            <h2 className="text-seccion font-semibold">
              {rango.rango.desde === rango.rango.hasta ? 'Ventas por hora' : 'Ventas por día'}
            </h2>
            <Barras barras={reporte.barras} porHora={rango.rango.desde === rango.rango.hasta} />
          </section>
        </div>
      )}
      {reporte && pestana === 'productos' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-grafito-suave">Ordenar por</span>
            {(['importe', 'cantidad'] as const).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={orden === o}
                onClick={() => setOrden(o)}
                className={`min-h-12 rounded-boton border px-4 font-semibold ${
                  orden === o ? 'border-grafito bg-grafito text-papel' : 'border-linea bg-papel'
                }`}
              >
                {o === 'importe' ? 'Importe' : 'Cantidad'}
              </button>
            ))}
          </div>
          <TablaReporte tabla={tablaDe('productos', reporte, orden)} />
        </div>
      )}
      {reporte && pestana !== 'resumen' && pestana !== 'productos' && (
        <TablaReporte tabla={tablaDe(pestana, reporte, orden)} />
      )}
    </Pantalla>
  );
}
