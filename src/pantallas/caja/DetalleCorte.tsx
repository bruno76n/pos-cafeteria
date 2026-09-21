import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { Pantalla } from '@/componentes/Pantalla';
import { TablaCifras } from '@/componentes/TablaCifras';
import { useConfig, useTurno } from '@/datos/consultas';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';
import { VistaTicket } from '@/impresion/html';
import { construirTicketCorte } from '@/impresion/ticket';
import { useImpresora } from '@/impresion/usarImpresora';
import { textoDiferencia } from './diferencia';
import { filasTotalesTurno } from './filasResumen';

/** Detalle de un corte con su ticket y reimpresión. */
export function DetalleCorte() {
  const { id } = useParams();
  const turno = useTurno(id);
  const config = useConfig();
  const { imprimir, error, imprimiendo } = useImpresora();
  if (turno === undefined || config === undefined) return null;
  if (!turno?.resumen || !config) {
    return (
      <Pantalla titulo="Corte de caja">
        <p className="text-grafito-suave">Este corte no está en la tablet.</p>
      </Pantalla>
    );
  }
  const r = turno.resumen;
  const dif = textoDiferencia(r.diferencia ?? 0);
  const doc = construirTicketCorte(turno, config, { reimpresion: true });

  return (
    <Pantalla
      titulo={`Corte ${turno.dispositivoNombre}`}
      acciones={
        <>
          <Link to="/caja/cortes" className={clasesBoton('claro')}>
            <ArrowLeft aria-hidden /> Cortes
          </Link>
          <Boton variante="oscuro" disabled={imprimiendo} onClick={() => imprimir(doc)}>
            <Printer aria-hidden /> {error ? 'Reintentar' : 'Reimprimir'}
          </Boton>
        </>
      }
    >
      {error && (
        <p className="text-faltante" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-4">
          <p className="text-grafito-suave">
            Abrió {turno.abiertoPor.nombre} el {formatearFechaHora(turno.abiertoEn)} · Cerró{' '}
            {turno.cerradoPor?.nombre} el {turno.cerradoEn && formatearFechaHora(turno.cerradoEn)}
          </p>
          <div className="rounded-hoja border border-linea bg-papel px-5 py-3">
            <TablaCifras
              filas={[
                ...filasTotalesTurno(r),
                { etiqueta: 'Efectivo esperado', valor: formatearDinero(r.efectivoEsperado), fuerte: true },
                {
                  etiqueta: 'Efectivo contado',
                  valor: formatearDinero(r.efectivoContado ?? 0),
                  fuerte: true,
                },
                { etiqueta: 'Diferencia', valor: dif.texto, fuerte: true, tono: dif.tono },
              ]}
            />
          </div>
          {turno.nota && <p>Nota: {turno.nota}</p>}
        </div>
        <VistaTicket doc={doc} className="self-start" />
      </div>
    </Pantalla>
  );
}
