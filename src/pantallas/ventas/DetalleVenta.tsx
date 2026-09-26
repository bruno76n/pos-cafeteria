import { ArrowLeft, ChefHat, Minus, Plus, Printer, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { BotonCompartir } from '@/componentes/BotonCompartir';
import { Campo } from '@/componentes/Campo';
import { Hoja } from '@/componentes/Hoja';
import { Insignia } from '@/componentes/Insignia';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import {
  useConfig,
  useDevolucionesDeVenta,
  usePendientes,
  useTurno,
  useTurnoAbierto,
  useVenta,
} from '@/datos/consultas';
import { cancelarVenta, registrarDevolucion } from '@/datos/escrituras';
import { NOMBRE_METODO } from '@/dominio/cobro';
import {
  calcularReembolso,
  cantidadesDevueltas,
  devolverTodo,
  puedeCancelar,
  puedeDevolver,
  type LineaADevolver,
} from '@/dominio/devoluciones';
import { formatearDinero } from '@/dominio/dinero';
import { formatearFechaHora } from '@/dominio/fechas';
import { NOMBRE_ESTADO } from '@/dominio/historial';
import { nombreLinea } from '@/dominio/personalizacion';
import type { Devolucion, MetodoPago, Venta } from '@/dominio/tipos';
import { useAutorizar } from '@/estado/autorizacion';
import { useDispositivoActual } from '@/estado/dispositivo';
import { construirComanda, opcionesComanda } from '@/impresion/comanda';
import { VistaTicket } from '@/impresion/html';
import { ticketATexto } from '@/impresion/ticket';
import { ticketDeVenta } from '@/impresion/ticketVenta';
import { useImpresora } from '@/impresion/usarImpresora';
import { InsigniaPorSubir, TONO_ESTADO } from './Historial';

function DialogoCancelar({
  venta,
  alCerrar,
  alCancelar,
}: {
  venta: Venta;
  alCerrar: () => void;
  alCancelar: () => void;
}) {
  const autorizar = useAutorizar();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    if (!motivo.trim()) return setError('Escribe el motivo.');
    const permitido = await autorizar('cancelarVentas');
    if (!permitido) return;
    try {
      await cancelarVenta({ ventaId: venta.id, motivo, ...permitido });
      alCancelar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Hoja
      titulo={`Cancelar la venta ${venta.folio} por ${formatearDinero(venta.total)}`}
      centrada
      ancho="max-w-lg"
      alCerrar={alCerrar}
      pie={
        <div className="flex justify-end gap-2">
          <Boton tamano="grande" onClick={alCerrar}>
            Volver
          </Boton>
          <Boton variante="peligro" tamano="grande" onClick={cancelar}>
            Cancelar venta
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-grafito-suave">
          El dinero se devuelve en este momento y la venta deja de contar en la caja.
        </p>
        <Campo
          etiqueta="Motivo"
          value={motivo}
          maxLength={120}
          onChange={(e) => setMotivo(e.target.value)}
          error={error}
        />
      </div>
    </Hoja>
  );
}

function DialogoDevolucion({
  venta,
  previas,
  alCerrar,
}: {
  venta: Venta;
  previas: Devolucion[];
  alCerrar: () => void;
}) {
  const config = useConfig();
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const autorizar = useAutorizar();
  const devueltas = cantidadesDevueltas(previas);
  const [seleccion, setSeleccion] = useState<LineaADevolver[]>(() => devolverTodo(venta, previas));
  const metodos: MetodoPago[] = [
    'efectivo',
    ...(config?.pagos.tarjeta ? (['tarjeta'] as const) : []),
    ...(config?.pagos.transferencia ? (['transferencia'] as const) : []),
  ];
  const [metodo, setMetodo] = useState<MetodoPago>(venta.pagos[0]?.metodo ?? 'efectivo');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reembolso = calcularReembolso(venta, seleccion, previas);
  const cantidad = (lineaId: string) => seleccion.find((s) => s.lineaId === lineaId)?.cantidad ?? 0;
  const cambiarCantidad = (lineaId: string, n: number) =>
    setSeleccion((s) => [...s.filter((x) => x.lineaId !== lineaId), { lineaId, cantidad: n }]);

  async function devolver() {
    if (!reembolso.ok) return setError(reembolso.error);
    if (!motivo.trim()) return setError('Escribe el motivo.');
    if (metodo === 'efectivo' && !turno)
      return setError('Para devolver en efectivo abre la caja de este dispositivo.');
    const permitido = await autorizar('cancelarVentas');
    if (!permitido) return;
    try {
      await registrarDevolucion({ ventaId: venta.id, seleccion, metodo, motivo, ...permitido });
      alCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Hoja
      titulo={`Devolución de la venta ${venta.folio}`}
      alCerrar={alCerrar}
      pie={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-seccion">
            Reembolso:{' '}
            <span className="cifras font-bold">{formatearDinero(reembolso.ok ? reembolso.monto : 0)}</span>
          </p>
          <Boton variante="oscuro" tamano="grande" onClick={devolver} disabled={!reembolso.ok}>
            Devolver
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Boton onClick={() => setSeleccion(devolverTodo(venta, previas))}>Todo</Boton>
          <Boton onClick={() => setSeleccion([])}>Nada</Boton>
        </div>
        <ul className="flex flex-col">
          {venta.lineas.map((l) => {
            const disponible = l.cantidad - (devueltas.get(l.id) ?? 0);
            const n = cantidad(l.id);
            return (
              <li key={l.id} className="flex items-center gap-3 border-b border-linea py-2">
                <span className="flex-1">
                  <span className="font-semibold">{nombreLinea(l)}</span>
                  <span className="ml-2 text-etiqueta text-grafito-suave">
                    {disponible} de {l.cantidad} por devolver · {formatearDinero(l.precioUnitario)} c/u
                  </span>
                </span>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Devolver uno menos de ${nombreLinea(l)}`}
                  disabled={n <= 0}
                  onClick={() => cambiarCantidad(l.id, n - 1)}
                >
                  <Minus aria-hidden />
                </Boton>
                <span
                  className="cifras w-8 text-center text-producto font-semibold"
                  aria-label={`${nombreLinea(l)}: ${n}`}
                >
                  {n}
                </span>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Devolver uno más de ${nombreLinea(l)}`}
                  disabled={n >= disponible}
                  onClick={() => cambiarCantidad(l.id, n + 1)}
                >
                  <Plus aria-hidden />
                </Boton>
              </li>
            );
          })}
        </ul>
        <Segmentos
          etiqueta="Reembolso en"
          valor={metodo}
          alCambiar={setMetodo}
          opciones={metodos.map((m) => ({ valor: m, texto: NOMBRE_METODO[m] }))}
        />
        {metodo === 'efectivo' && !turno && (
          <p className="text-ambar">Para devolver en efectivo abre la caja de este dispositivo.</p>
        )}
        <Campo etiqueta="Motivo" value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} />
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  );
}

/** Detalle de la venta: ticket, reimprimir, compartir, cancelar y devolución. */
export function DetalleVenta() {
  const { id } = useParams();
  const venta = useVenta(id);
  const config = useConfig();
  const turno = useTurno(venta?.turnoId);
  const devoluciones = useDevolucionesDeVenta(venta?.id);
  const pendientes = usePendientes('ventas');
  const { imprimirTrabajos, error, fallo, imprimiendo, columnas } = useImpresora();
  const [cancelando, setCancelando] = useState(false);
  const [avisarCocina, setAvisarCocina] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);

  if (venta === undefined || config === undefined || devoluciones === undefined) return null;
  if (!venta || !config) {
    return (
      <Pantalla titulo="Venta">
        <p className="text-grafito-suave">Esta venta no está en la tablet.</p>
      </Pantalla>
    );
  }
  const doc = ticketDeVenta(venta, config, { columnas });
  const cancelada = venta.estado === 'cancelada';
  // Solo si hay algo que se preparó (líneas que van a cocina).
  const comanda = construirComanda(venta, config, { columnas, cancelada, reimpresion: !cancelada });
  const copiasComanda = opcionesComanda(config.ticket).copias;
  const imprimirComanda = () =>
    comanda && imprimirTrabajos([{ tipo: 'comanda', doc: comanda, copias: copiasComanda }]);

  return (
    <Pantalla
      titulo={`Venta ${venta.folio}`}
      acciones={
        <Link to="/ventas" className={clasesBoton('claro')}>
          <ArrowLeft aria-hidden /> Historial
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <VistaTicket doc={doc} className="self-start" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono={TONO_ESTADO[venta.estado]}>{NOMBRE_ESTADO[venta.estado]}</Insignia>
            {pendientes?.has(venta.id) && <InsigniaPorSubir />}
            <span className="text-grafito-suave">
              {formatearFechaHora(venta.fecha)} · {venta.dispositivoNombre} · {venta.cajero.nombre}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Boton
              tamano="grande"
              disabled={imprimiendo}
              onClick={() =>
                imprimirTrabajos([
                  { tipo: 'ticket', doc: ticketDeVenta(venta, config, { columnas, reimpresion: true }) },
                ])
              }
            >
              <Printer aria-hidden />{' '}
              {fallo?.fallidos.includes('ticket') ? 'Reintentar' : 'Reimprimir ticket'}
            </Boton>
            {comanda && (
              <Boton tamano="grande" disabled={imprimiendo} onClick={imprimirComanda}>
                <ChefHat aria-hidden /> {cancelada ? 'Imprimir comanda cancelada' : 'Reimprimir comanda'}
              </Boton>
            )}
            <BotonCompartir titulo={`Ticket ${venta.folio}`} texto={ticketATexto(doc)} />
            {puedeCancelar(venta, turno ?? undefined) && (
              <Boton variante="peligro" tamano="grande" onClick={() => setCancelando(true)}>
                <XCircle aria-hidden /> Cancelar venta
              </Boton>
            )}
            {puedeDevolver(venta) && (
              <Boton tamano="grande" onClick={() => setDevolviendo(true)}>
                <RotateCcw aria-hidden /> Devolución
              </Boton>
            )}
          </div>
          {error && (
            <div role="alert">
              <p className="text-faltante">{error}</p>
              {fallo?.ayuda && <p className="text-grafito-suave">{fallo.ayuda}</p>}
            </div>
          )}
          {avisarCocina && comanda && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-boton border border-ambar/30 bg-ambar-fondo p-3"
            >
              <p className="flex-1">Esta venta ya se mandó a cocina. Avisa en barra que no la preparen.</p>
              <Boton variante="oscuro" disabled={imprimiendo} onClick={imprimirComanda}>
                <ChefHat aria-hidden /> Imprimir aviso a cocina
              </Boton>
            </div>
          )}
          {venta.cancelacion && (
            <p className="rounded-boton bg-faltante/10 p-3 text-faltante">
              Cancelada por {venta.cancelacion.usuario.nombre}
              {venta.cancelacion.autorizadoPor ? ` (autorizó ${venta.cancelacion.autorizadoPor.nombre})` : ''}
              : {venta.cancelacion.motivo}
            </p>
          )}
          {devoluciones.length > 0 && (
            <section className="rounded-hoja border border-linea bg-papel p-4" aria-label="Devoluciones">
              <h2 className="mb-2 text-seccion font-semibold">Devoluciones</h2>
              <ul className="flex flex-col gap-2">
                {devoluciones.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-linea pb-2 last:border-b-0"
                  >
                    <span>
                      {formatearFechaHora(d.fecha)} · {NOMBRE_METODO[d.metodo]} · {d.motivo}
                      <span className="block text-etiqueta text-grafito-suave">
                        {d.usuario.nombre}
                        {d.autorizadoPor ? ` (autorizó ${d.autorizadoPor.nombre})` : ''}
                      </span>
                    </span>
                    <span className="cifras font-semibold">{formatearDinero(d.monto)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      {cancelando && (
        <DialogoCancelar
          venta={venta}
          alCerrar={() => setCancelando(false)}
          alCancelar={() => {
            setCancelando(false);
            setAvisarCocina(opcionesComanda(config.ticket).imprimir);
          }}
        />
      )}
      {devolviendo && (
        <DialogoDevolucion venta={venta} previas={devoluciones} alCerrar={() => setDevolviendo(false)} />
      )}
    </Pantalla>
  );
}
