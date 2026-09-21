import { ArrowLeft, Banknote, CreditCard, Landmark } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from '@/componentes/Boton';
import {
  agregarPago,
  cobroCompleto,
  NOMBRE_METODO,
  pendiente as calcularPendiente,
  quitarPago,
  type NuevoPago,
} from '@/dominio/cobro';
import { formatearDinero } from '@/dominio/dinero';
import type { ConfigGeneral, MetodoPago, Pago } from '@/dominio/tipos';
import { PanelEfectivo } from './PanelEfectivo';
import { PanelTarjeta } from './PanelTarjeta';
import { PanelTransferencia } from './PanelTransferencia';

const ICONOS = { efectivo: Banknote, tarjeta: CreditCard, transferencia: Landmark };

/**
 * Capa de cobro (ocupa la pantalla). La venta se confirma en cuanto un pago deja el pendiente
 * en cero. "Volver a la venta" descarta los pagos agregados.
 */
export function CapaCobro({
  total,
  config,
  alConfirmar,
  alVolver,
}: {
  total: number;
  config: ConfigGeneral;
  /** Registra la venta con estos pagos. */
  alConfirmar: (pagos: Pago[]) => Promise<void>;
  alVolver: () => void;
}) {
  const metodos: MetodoPago[] = [
    'efectivo',
    ...(config.pagos.tarjeta ? (['tarjeta'] as const) : []),
    ...(config.pagos.transferencia ? (['transferencia'] as const) : []),
  ];
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const porCobrar = calcularPendiente(total, pagos);

  async function confirmar(conPagos: Pago[]) {
    setConfirmando(true);
    try {
      await alConfirmar(conPagos);
    } catch (e) {
      setError(`No se pudo guardar la venta: ${(e as Error).message}`);
      setConfirmando(false);
    }
  }

  function pagar(nuevo: NuevoPago) {
    const r = agregarPago(total, pagos, nuevo, {
      referenciaTransferenciaObligatoria: config.pagos.referenciaTransferenciaObligatoria,
    });
    if (!r.ok) return setError(r.error);
    setError(null);
    if (cobroCompleto(total, r.pagos)) return void confirmar(r.pagos);
    setPagos(r.pagos);
    const siguiente = metodos.find((m) => !r.pagos.some((p) => p.metodo === m));
    if (siguiente) setMetodo(siguiente);
  }

  const usado = (m: MetodoPago) => pagos.some((p) => p.metodo === m);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cobro"
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-acero"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-linea bg-papel px-4 py-3">
        <Boton tamano="grande" onClick={alVolver} disabled={confirmando}>
          <ArrowLeft aria-hidden /> Volver a la venta
        </Boton>
        <div className="flex items-baseline gap-4">
          <span className="text-seccion text-grafito-suave">Total a cobrar</span>
          <span className="cifras text-total font-extrabold">{formatearDinero(total)}</span>
        </div>
      </header>

      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
          <p className="text-pantalla font-bold">Nada que cobrar</p>
          <Boton
            variante="dinero"
            tamano="enorme"
            className="min-w-72"
            disabled={confirmando}
            onClick={() => confirmar([])}
          >
            Confirmar
          </Boton>
          {error && (
            <p className="text-faltante" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px] portrait:grid-cols-1">
          <section
            className="flex min-w-0 flex-col gap-4 rounded-hoja bg-papel p-4"
            aria-label="Método de pago"
          >
            <div
              role="tablist"
              aria-label="Métodos de pago"
              className="grid auto-cols-fr grid-flow-col gap-2"
            >
              {metodos.map((m) => {
                const Icono = ICONOS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={metodo === m}
                    disabled={usado(m)}
                    onClick={() => {
                      setMetodo(m);
                      setError(null);
                    }}
                    className={`flex min-h-16 items-center justify-center gap-2 rounded-boton border text-producto font-semibold disabled:opacity-40 ${
                      metodo === m ? 'border-grafito bg-grafito text-papel' : 'border-linea bg-papel'
                    }`}
                  >
                    <Icono aria-hidden /> {NOMBRE_METODO[m]}
                  </button>
                );
              })}
            </div>
            {error && (
              <p className="text-faltante" role="alert">
                {error}
              </p>
            )}
            {metodo === 'efectivo' && <PanelEfectivo key={porCobrar} pendiente={porCobrar} alPagar={pagar} />}
            {metodo === 'tarjeta' && <PanelTarjeta key={porCobrar} pendiente={porCobrar} alPagar={pagar} />}
            {metodo === 'transferencia' && (
              <PanelTransferencia
                key={porCobrar}
                pendiente={porCobrar}
                cuentas={config.pagos.cuentas}
                referenciaObligatoria={config.pagos.referenciaTransferenciaObligatoria}
                alPagar={pagar}
              />
            )}
          </section>

          <aside className="flex flex-col gap-3 rounded-hoja bg-papel p-4" aria-label="Pagos">
            <h2 className="text-seccion font-semibold">Pagos</h2>
            {pagos.length === 0 ? (
              <p className="text-grafito-suave">Ninguno todavía.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pagos.map((p) => (
                  <li key={p.metodo} className="flex items-center gap-2 border-b border-linea pb-2">
                    <div className="flex flex-1 flex-col">
                      <span className="flex justify-between font-semibold">
                        {NOMBRE_METODO[p.metodo]} <span className="cifras">{formatearDinero(p.monto)}</span>
                      </span>
                      {p.recibido !== undefined && p.recibido !== p.monto && (
                        <span className="cifras text-etiqueta text-grafito-suave">
                          Recibido {formatearDinero(p.recibido)}
                        </span>
                      )}
                      {p.referencia && (
                        <span className="text-etiqueta text-grafito-suave">Ref. {p.referencia}</span>
                      )}
                    </div>
                    <Boton variante="fantasma" onClick={() => setPagos(quitarPago(pagos, p.metodo))}>
                      Quitar
                    </Boton>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-baseline justify-between border-t border-linea pt-3">
              <span className="text-seccion">Pendiente</span>
              <span className="cifras text-pantalla font-bold">{formatearDinero(porCobrar)}</span>
            </div>
          </aside>
        </div>
      )}
    </div>,
    document.body,
  );
}
