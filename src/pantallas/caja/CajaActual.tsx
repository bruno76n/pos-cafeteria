import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { clasesEntrada } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import { TablaCifras } from '@/componentes/TablaCifras';
import { useDatosDelTurno, useTurnoAbierto } from '@/datos/consultas';
import { cerrarTurno } from '@/datos/escrituras';
import { useVentasPorSubir } from '@/datos/estadoSync';
import { avisoCajaAbierta, resumirTurno, totalConteo } from '@/dominio/caja';
import { formatearDinero } from '@/dominio/dinero';
import { diaLocal, formatearFecha, formatearHora } from '@/dominio/fechas';
import type { Movimiento, Turno } from '@/dominio/tipos';
import { useAutorizar } from '@/estado/autorizacion';
import { useDispositivoActual } from '@/estado/dispositivo';
import { refUsuario, useUsuarioActivo } from '@/estado/sesion';
import { ConteoPorDenominaciones } from './ConteoEfectivo';
import { CorteCerrado } from './CorteCerrado';
import { DialogoMovimiento } from './DialogoMovimiento';
import { textoDiferencia } from './diferencia';
import { filasTotalesTurno } from './filasResumen';
import { FormularioAbrirCaja } from './FormularioAbrirCaja';

/**
 * Caja actual y cierre en la misma pantalla: a la izquierda se cuenta el efectivo y a la derecha
 * se ven los totales del turno, el efectivo esperado, lo contado y la diferencia en vivo.
 */
function CajaAbierta({ turno, alCerrar }: { turno: Turno; alCerrar: (cerrado: Turno) => void }) {
  const datos = useDatosDelTurno(turno.id);
  const { usuario, puede } = useUsuarioActivo();
  const autorizar = useAutorizar();
  const porSubir = useVentasPorSubir();
  const [registrando, setRegistrando] = useState<Movimiento['tipo'] | null>(null);
  const [autorizado, setAutorizado] = useState(false);
  const [modo, setModo] = useState<'denominaciones' | 'total'>('denominaciones');
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  if (!datos || !usuario) return null;

  const puedeCerrar = puede('cerrarCaja') || autorizado;
  const contado = modo === 'denominaciones' ? totalConteo(conteo) : (total ?? 0);
  const yaContado = modo === 'total' ? total !== null : Object.values(conteo).some((n) => n > 0);
  const resumen = resumirTurno({ turno, ...datos, contado });
  const diferencia = textoDiferencia(resumen.diferencia ?? 0);
  const aviso = avisoCajaAbierta(turno.dia, diaLocal());

  async function cerrar() {
    setGuardando(true);
    alCerrar(
      await cerrarTurno({
        turnoId: turno.id,
        usuario: refUsuario(usuario!),
        efectivoContado: contado,
        conteo: modo === 'denominaciones' ? conteo : undefined,
        nota,
      }),
    );
  }

  return (
    <Pantalla
      titulo="Caja actual"
      acciones={
        <>
          <Boton onClick={() => setRegistrando('entrada')}>Registrar entrada</Boton>
          <Boton onClick={() => setRegistrando('retiro')}>Registrar retiro</Boton>
          <Boton onClick={() => setRegistrando('gasto')}>Registrar gasto</Boton>
        </>
      }
    >
      {aviso && (
        <p className="rounded-boton bg-ambar-fondo p-3 text-ambar" role="alert">
          {aviso}
        </p>
      )}
      <p className="text-producto">
        Abierta por <strong>{turno.abiertoPor.nombre}</strong> desde las {formatearHora(turno.abiertoEn)}
        {aviso && ` del ${formatearFecha(turno.abiertoEn)}`}
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section
          className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-5"
          aria-label="Contar efectivo"
        >
          <h2 className="text-seccion font-semibold">Cerrar caja · Contar efectivo</h2>
          {puedeCerrar ? (
            <>
              <Segmentos
                etiqueta="Cómo contar"
                valor={modo}
                alCambiar={setModo}
                opciones={[
                  { valor: 'denominaciones', texto: 'Por denominaciones' },
                  { valor: 'total', texto: 'Capturar total' },
                ]}
              />
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
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-grafito-suave">Tu usuario no puede cerrar caja.</p>
              <Boton
                variante="oscuro"
                onClick={async () => setAutorizado(Boolean(await autorizar('cerrarCaja')))}
              >
                Pedir autorización para cerrar caja
              </Boton>
            </div>
          )}
        </section>
        <section
          className="flex flex-col gap-3 rounded-hoja border border-linea bg-papel px-5 py-3 lg:sticky lg:top-0"
          aria-label="Resumen del turno"
        >
          {(puedeCerrar || puede('verReportes')) && (
            <TablaCifras
              filas={[
                {
                  etiqueta: 'Efectivo esperado',
                  valor: formatearDinero(resumen.efectivoEsperado),
                  fuerte: true,
                },
                ...(puedeCerrar
                  ? [{ etiqueta: 'Efectivo contado', valor: formatearDinero(contado), fuerte: true }]
                  : []),
              ]}
            />
          )}
          {puedeCerrar && (
            <>
              <p
                role="status"
                aria-label="Diferencia"
                className={`cifras py-1 text-center text-[36px] leading-none font-extrabold ${
                  !yaContado
                    ? 'text-grafito-suave'
                    : diferencia.tono === 'faltante'
                      ? 'text-faltante'
                      : diferencia.tono === 'cafeto'
                        ? 'text-cafeto'
                        : ''
                }`}
              >
                {yaContado ? diferencia.texto : 'Cuenta el efectivo'}
              </p>
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
              <Boton variante="oscuro" tamano="grande" disabled={!yaContado || guardando} onClick={cerrar}>
                Cerrar caja
              </Boton>
            </>
          )}
          <h3 className="mt-2 border-t border-linea pt-3 font-semibold">Totales del turno</h3>
          <TablaCifras filas={filasTotalesTurno(resumen)} />
        </section>
      </div>
      {registrando && (
        <DialogoMovimiento turno={turno} tipo={registrando} alCerrar={() => setRegistrando(null)} />
      )}
    </Pantalla>
  );
}

export function CajaActual() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  // Al cerrar, el turno deja de estar abierto: se conserva para mostrar el corte.
  const [cerrado, setCerrado] = useState<Turno | null>(null);

  if (cerrado) return <CorteCerrado turno={cerrado} alSalir={() => setCerrado(null)} />;
  if (dispositivo && (dispositivo.tipo === 'consulta' || !dispositivo.activo)) {
    return (
      <Pantalla titulo="Caja actual">
        <p className="text-grafito-suave">
          {dispositivo.activo
            ? 'Este dispositivo es de consulta: no tiene caja. Revisa los cortes de caja.'
            : 'Esta tablet está desactivada: no vende ni abre caja. Actívala desde otra tablet en Configuración › Dispositivo.'}
        </p>
      </Pantalla>
    );
  }
  if (turno === undefined) return null;
  if (!turno) {
    return (
      <Pantalla titulo="Caja actual">
        <div className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-6">
          <h2 className="text-seccion font-semibold">La caja está cerrada</h2>
          <FormularioAbrirCaja />
        </div>
      </Pantalla>
    );
  }
  return <CajaAbierta key={turno.id} turno={turno} alCerrar={setCerrado} />;
}
