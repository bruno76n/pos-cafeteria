import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Confirmar } from '@/componentes/Confirmar';
import { Insignia } from '@/componentes/Insignia';
import { Pantalla } from '@/componentes/Pantalla';
import { useDatosDelTurno, useTurnoAbierto } from '@/datos/consultas';
import { anularMovimiento } from '@/datos/escrituras';
import { formatearDinero } from '@/dominio/dinero';
import { formatearHora } from '@/dominio/fechas';
import type { Movimiento } from '@/dominio/tipos';
import { useAutorizar } from '@/estado/autorizacion';
import { useDispositivoActual } from '@/estado/dispositivo';
import { DialogoMovimiento } from './DialogoMovimiento';

const NOMBRE_TIPO: Record<Movimiento['tipo'], string> = {
  entrada: 'Entrada',
  retiro: 'Retiro',
  gasto: 'Gasto',
};

/** Movimientos del turno abierto: registrar, ver y anular (queda tachado, no se borra). */
export function Movimientos() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const datos = useDatosDelTurno(turno?.id);
  const autorizar = useAutorizar();
  const [registrando, setRegistrando] = useState<Movimiento['tipo'] | null>(null);
  const [anulando, setAnulando] = useState<Movimiento | null>(null);

  if (turno === undefined) return null;
  if (!turno) {
    return (
      <Pantalla titulo="Movimientos">
        <p className="text-grafito-suave">La caja está cerrada. Ábrela para registrar movimientos.</p>
      </Pantalla>
    );
  }
  const movimientos = [...(datos?.movimientos ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha));

  async function anular(m: Movimiento) {
    setAnulando(null);
    const permitido = await autorizar('registrarGastos');
    if (permitido) await anularMovimiento(m.id, permitido.autorizadoPor ?? permitido.usuario);
  }

  return (
    <Pantalla
      titulo="Movimientos"
      acciones={
        <>
          <Boton onClick={() => setRegistrando('entrada')}>Registrar entrada</Boton>
          <Boton onClick={() => setRegistrando('retiro')}>Registrar retiro</Boton>
          <Boton onClick={() => setRegistrando('gasto')}>Registrar gasto</Boton>
        </>
      }
    >
      {movimientos.length === 0 ? (
        <p className="p-8 text-center text-grafito-suave">Todavía no hay movimientos en este turno.</p>
      ) : (
        <ul className="flex flex-col rounded-hoja border border-linea bg-papel">
          {movimientos.map((m) => (
            <li
              key={m.id}
              className="flex min-h-14 flex-wrap items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0"
            >
              <span className="cifras w-14 text-grafito-suave">{formatearHora(m.fecha)}</span>
              <Insignia tono={m.tipo === 'entrada' ? 'cafeto' : 'neutro'}>{NOMBRE_TIPO[m.tipo]}</Insignia>
              <span className={`min-w-0 flex-1 ${m.anulado ? 'text-grafito-suave line-through' : ''}`}>
                {[m.categoria, m.concepto].filter(Boolean).join(' · ') || NOMBRE_TIPO[m.tipo]}
                <span className="ml-2 text-etiqueta text-grafito-suave no-underline">{m.usuario.nombre}</span>
              </span>
              <span className={`cifras font-semibold ${m.anulado ? 'text-grafito-suave line-through' : ''}`}>
                {m.tipo === 'entrada' ? '+' : '−'}
                {formatearDinero(m.monto)}
              </span>
              {m.anulado ? (
                <Insignia tono="faltante">
                  Anulado{m.anuladoPor ? ` por ${m.anuladoPor.nombre}` : ''}
                </Insignia>
              ) : (
                <Boton variante="fantasma" onClick={() => setAnulando(m)}>
                  Anular
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}
      {registrando && (
        <DialogoMovimiento turno={turno} tipo={registrando} alCerrar={() => setRegistrando(null)} />
      )}
      {anulando && (
        <Confirmar
          titulo="¿Anular el movimiento?"
          textoAccion="Anular"
          textoCancelar="Volver"
          alConfirmar={() => anular(anulando)}
          alCancelar={() => setAnulando(null)}
        >
          <p>
            {NOMBRE_TIPO[anulando.tipo]} de {formatearDinero(anulando.monto)}. Quedará visible y tachado, pero
            ya no contará en la caja.
          </p>
        </Confirmar>
      )}
    </Pantalla>
  );
}
