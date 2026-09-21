import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Boton } from '@/componentes/Boton';
import { clasesEntrada } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Pantalla } from '@/componentes/Pantalla';
import { RequierePermiso } from '@/componentes/RequierePermiso';
import { Segmentos } from '@/componentes/Segmentos';
import { TablaCifras } from '@/componentes/TablaCifras';
import { TecladoNumerico, aplicarTecla } from '@/componentes/TecladoNumerico';
import { useDatosDelTurno, useTurnoAbierto } from '@/datos/consultas';
import { cerrarTurno } from '@/datos/escrituras';
import { useVentasPorSubir } from '@/datos/estadoSync';
import { DENOMINACIONES, resumirTurno, totalConteo } from '@/dominio/caja';
import { formatearDinero } from '@/dominio/dinero';
import type { Turno } from '@/dominio/tipos';
import { useDispositivoActual } from '@/estado/dispositivo';
import { refUsuario, useUsuarioActivo } from '@/estado/sesion';
import { CorteCerrado } from './CorteCerrado';
import { textoDiferencia } from './diferencia';

function ConteoPorDenominaciones({
  conteo,
  alCambiar,
}: {
  conteo: Record<string, number>;
  alCambiar: (conteo: Record<string, number>) => void;
}) {
  const [fila, setFila] = useState(DENOMINACIONES[0]!.clave);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
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
      <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
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

function Cierre({ turno }: { turno: Turno }) {
  const navegar = useNavigate();
  const datos = useDatosDelTurno(turno.id);
  const { usuario } = useUsuarioActivo();
  const porSubir = useVentasPorSubir();
  const [modo, setModo] = useState<'denominaciones' | 'total'>('denominaciones');
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [paso, setPaso] = useState<'contar' | 'resultado'>('contar');
  const [nota, setNota] = useState('');
  const [cerrado, setCerrado] = useState<Turno | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (cerrado) return <CorteCerrado turno={cerrado} />;
  if (!datos || !usuario) return null;

  const contado = modo === 'denominaciones' ? totalConteo(conteo) : (total ?? 0);
  const resumen = resumirTurno({ turno, ...datos, contado });

  async function cerrar() {
    setGuardando(true);
    setCerrado(
      await cerrarTurno({
        turnoId: turno.id,
        usuario: refUsuario(usuario!),
        efectivoContado: contado,
        conteo: modo === 'denominaciones' ? conteo : undefined,
        nota,
      }),
    );
  }

  if (paso === 'contar') {
    return (
      <Pantalla titulo="Cerrar caja · Contar efectivo">
        <Segmentos
          etiqueta="Cómo contar"
          valor={modo}
          alCambiar={setModo}
          opciones={[
            { valor: 'denominaciones', texto: 'Por denominaciones' },
            { valor: 'total', texto: 'Capturar total' },
          ]}
        />
        <div className="rounded-hoja bg-papel p-5">
          {modo === 'denominaciones' ? (
            <ConteoPorDenominaciones conteo={conteo} alCambiar={setConteo} />
          ) : (
            <CampoDinero
              etiqueta="Efectivo contado"
              valor={total}
              alCambiar={setTotal}
              className="max-w-sm"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-seccion">
            Contado: <span className="cifras font-bold">{formatearDinero(contado)}</span>
          </p>
          <div className="flex gap-2">
            <Boton tamano="grande" onClick={() => navegar('/caja')}>
              <ArrowLeft aria-hidden /> Volver
            </Boton>
            <Boton
              variante="oscuro"
              tamano="grande"
              disabled={modo === 'total' && total === null}
              onClick={() => setPaso('resultado')}
            >
              Continuar
            </Boton>
          </div>
        </div>
      </Pantalla>
    );
  }

  const diferencia = textoDiferencia(resumen.diferencia ?? 0);
  return (
    <Pantalla titulo="Cerrar caja · Resultado">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-hoja bg-papel p-5" aria-label="Diferencia">
          <TablaCifras
            filas={[
              { etiqueta: 'Efectivo esperado', valor: formatearDinero(resumen.efectivoEsperado) },
              { etiqueta: 'Efectivo contado', valor: formatearDinero(contado) },
            ]}
          />
          <p
            className={`cifras py-4 text-center text-[48px] leading-none font-extrabold ${
              diferencia.tono === 'faltante'
                ? 'text-faltante'
                : diferencia.tono === 'cafeto'
                  ? 'text-cafeto'
                  : ''
            }`}
          >
            {diferencia.texto}
          </p>
        </section>
        <section className="rounded-hoja bg-papel px-5 py-3" aria-label="Resumen del turno">
          <TablaCifras
            filas={[
              {
                etiqueta: `Total vendido (${resumen.ventas} ventas)`,
                valor: formatearDinero(resumen.totalVendido),
                fuerte: true,
              },
              { etiqueta: 'Efectivo', valor: formatearDinero(resumen.porMetodo.efectivo) },
              { etiqueta: 'Tarjeta', valor: formatearDinero(resumen.porMetodo.tarjeta) },
              { etiqueta: 'Transferencia', valor: formatearDinero(resumen.porMetodo.transferencia) },
              {
                etiqueta: `Cancelaciones (${resumen.cancelaciones.cantidad})`,
                valor: formatearDinero(resumen.cancelaciones.importe),
              },
              {
                etiqueta: `Devoluciones (${resumen.devoluciones.cantidad})`,
                valor: formatearDinero(resumen.devoluciones.importe),
              },
              { etiqueta: 'Gastos', valor: formatearDinero(resumen.gastos.total) },
              { etiqueta: 'Cierra', valor: usuario.nombre },
            ]}
          />
        </section>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-etiqueta text-grafito-suave">Nota (opcional)</span>
        <input
          className={clasesEntrada}
          value={nota}
          maxLength={200}
          onChange={(e) => setNota(e.target.value)}
        />
      </label>
      {porSubir > 0 && (
        <p className="rounded-boton bg-ambar-fondo p-3 text-ambar">
          Hay {porSubir} {porSubir === 1 ? 'venta' : 'ventas'} por subir; se subirán solas.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Boton tamano="grande" onClick={() => setPaso('contar')}>
          Volver a contar
        </Boton>
        <Boton variante="oscuro" tamano="grande" disabled={guardando} onClick={cerrar}>
          Cerrar caja
        </Boton>
      </div>
    </Pantalla>
  );
}

/** Cierre de caja en tres pasos: contar (sin ver el esperado), resultado y confirmar. */
export function CerrarCaja() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const [turnoFijo, setTurnoFijo] = useState<Turno | null>(null);
  // Al cerrar, el turno deja de estar abierto: se conserva para mostrar el corte.
  const actual = turno ?? turnoFijo;
  if (turno && turno.id !== turnoFijo?.id) setTurnoFijo(turno);
  if (turno === undefined && !turnoFijo) return null;
  if (!actual) {
    return (
      <Pantalla titulo="Cerrar caja">
        <p className="text-grafito-suave">La caja ya está cerrada.</p>
      </Pantalla>
    );
  }
  return (
    <RequierePermiso permiso="cerrarCaja">
      <Cierre turno={actual} />
    </RequierePermiso>
  );
}
