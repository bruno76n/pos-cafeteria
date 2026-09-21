import { Link } from 'react-router';
import { clasesBoton } from '@/componentes/Boton';
import { Pantalla } from '@/componentes/Pantalla';
import { TablaCifras } from '@/componentes/TablaCifras';
import { useDatosDelRango, useDatosDelTurno, useTurnoAbierto } from '@/datos/consultas';
import { avisoCajaAbierta, resumirTurno } from '@/dominio/caja';
import { formatearDinero } from '@/dominio/dinero';
import { diaLocal, formatearFecha, formatearHora } from '@/dominio/fechas';
import { calcularReporte } from '@/dominio/reportes';
import type { Turno } from '@/dominio/tipos';
import { useDispositivoActual } from '@/estado/dispositivo';
import { useUsuarioActivo } from '@/estado/sesion';

function Renglon({ etiqueta, valor, grande }: { etiqueta: string; valor: string; grande?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-linea py-3 last:border-b-0">
      <span className={grande ? 'text-seccion' : 'text-producto text-grafito-suave'}>{etiqueta}</span>
      <span className={`cifras ${grande ? 'text-pantalla font-bold' : 'text-seccion font-semibold'}`}>
        {valor}
      </span>
    </div>
  );
}

function EstadoCaja({ turno, conMontos }: { turno: Turno | null; conMontos: boolean }) {
  const datos = useDatosDelTurno(turno?.id);
  if (!turno) return <p className="text-producto">La caja de este dispositivo está cerrada.</p>;
  if (!datos) return null;
  const resumen = resumirTurno({ turno, ...datos });
  return (
    <div className="flex flex-col gap-1">
      <p className="text-producto">
        Abierta por <strong>{turno.abiertoPor.nombre}</strong> desde las {formatearHora(turno.abiertoEn)}
        {turno.dia !== diaLocal() && ` del ${formatearFecha(turno.abiertoEn)}`}
      </p>
      <p className="text-grafito-suave">
        {resumen.ventas} {resumen.ventas === 1 ? 'venta' : 'ventas'} en este turno
      </p>
      {conMontos && (
        <p className="text-producto">
          Efectivo esperado: <strong className="cifras">{formatearDinero(resumen.efectivoEsperado)}</strong>
        </p>
      )}
    </div>
  );
}

/** Inicio: cifras de hoy con verReportes; sin él, solo el estado de la caja y "Nueva venta". */
export function Inicio() {
  const hoy = diaLocal();
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const datos = useDatosDelRango({ desde: hoy, hasta: hoy });
  const { puede, usuario } = useUsuarioActivo();
  if (turno === undefined || !datos || !usuario) return null;

  const aviso = turno ? avisoCajaAbierta(turno.dia, hoy) : null;
  const esCaja = dispositivo?.tipo === 'caja';
  const accionPrincipal = esCaja && (
    <Link to="/venta" className={`${clasesBoton('oscuro', 'enorme')} w-full`}>
      {turno ? 'Nueva venta' : 'Abrir caja'}
    </Link>
  );
  const avisoCaja = aviso && (
    <p className="rounded-boton bg-ambar-fondo p-3 text-ambar" role="alert">
      {aviso}
    </p>
  );

  if (!puede('verReportes')) {
    return (
      <Pantalla titulo={`Hola, ${usuario.nombre}`}>
        {avisoCaja}
        <div className="flex max-w-xl flex-col gap-4 rounded-hoja bg-papel p-6">
          <h2 className="text-seccion font-semibold">Caja</h2>
          <EstadoCaja turno={turno} conMontos={false} />
          {accionPrincipal}
        </div>
      </Pantalla>
    );
  }

  const r = calcularReporte(datos, { desde: hoy, hasta: hoy });
  return (
    <Pantalla titulo="Hoy">
      {avisoCaja}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-hoja bg-papel px-6 py-3" aria-label="Ventas de hoy">
          <Renglon etiqueta="Total vendido" valor={formatearDinero(r.totalVendido)} grande />
          <Renglon etiqueta="Ventas" valor={String(r.numeroVentas)} />
          <Renglon etiqueta="Ticket promedio" valor={formatearDinero(r.ticketPromedio)} />
          <Renglon etiqueta="Efectivo" valor={formatearDinero(r.porMetodo.efectivo)} />
          <Renglon etiqueta="Tarjeta" valor={formatearDinero(r.porMetodo.tarjeta)} />
          <Renglon etiqueta="Transferencia" valor={formatearDinero(r.porMetodo.transferencia)} />
        </section>
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-hoja bg-papel p-5" aria-label="Caja actual">
            <h2 className="text-seccion font-semibold">Caja actual</h2>
            <EstadoCaja turno={turno} conMontos />
            {accionPrincipal}
          </section>
          <section className="rounded-hoja bg-papel p-5" aria-label="Más vendidos hoy">
            <h2 className="mb-2 text-seccion font-semibold">Más vendidos hoy</h2>
            {r.productos.length === 0 ? (
              <p className="text-grafito-suave">Todavía no hay ventas hoy.</p>
            ) : (
              <ol className="flex flex-col">
                {r.productos.slice(0, 5).map((p, i) => (
                  <li
                    key={p.productoId}
                    className="flex justify-between gap-3 border-b border-linea py-2 last:border-b-0"
                  >
                    <span>
                      <span className="cifras mr-2 text-grafito-suave">{i + 1}.</span>
                      {p.nombre}
                    </span>
                    <span className="cifras text-grafito-suave">
                      {p.cantidad} · {formatearDinero(p.importe)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="rounded-hoja bg-papel px-5 py-2" aria-label="Resumen del día">
            <TablaCifras
              filas={[
                {
                  etiqueta: `Cancelaciones (${r.cancelaciones.cantidad})`,
                  valor: formatearDinero(r.cancelaciones.importe),
                },
                {
                  etiqueta: `Devoluciones (${r.devoluciones.cantidad})`,
                  valor: formatearDinero(r.devoluciones.importe),
                },
                { etiqueta: 'Gastos', valor: formatearDinero(r.gastos.total) },
              ]}
            />
          </section>
        </div>
      </div>
    </Pantalla>
  );
}
