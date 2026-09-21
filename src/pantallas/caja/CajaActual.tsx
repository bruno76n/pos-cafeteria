import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Boton } from '@/componentes/Boton';
import { Pantalla } from '@/componentes/Pantalla';
import { TablaCifras } from '@/componentes/TablaCifras';
import { useDatosDelTurno, useTurnoAbierto } from '@/datos/consultas';
import { avisoCajaAbierta, resumirTurno } from '@/dominio/caja';
import { formatearDinero } from '@/dominio/dinero';
import { diaLocal, formatearFecha, formatearHora } from '@/dominio/fechas';
import type { Movimiento } from '@/dominio/tipos';
import { useDispositivoActual } from '@/estado/dispositivo';
import { useUsuarioActivo } from '@/estado/sesion';
import { DialogoMovimiento } from './DialogoMovimiento';
import { filasTotalesTurno } from './filasResumen';
import { FormularioAbrirCaja } from './FormularioAbrirCaja';

export function CajaActual() {
  const navegar = useNavigate();
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const datos = useDatosDelTurno(turno?.id);
  const { puede } = useUsuarioActivo();
  const [registrando, setRegistrando] = useState<Movimiento['tipo'] | null>(null);

  if (dispositivo?.tipo === 'consulta') {
    return (
      <Pantalla titulo="Caja actual">
        <p className="text-grafito-suave">
          Este dispositivo es de consulta: no tiene caja. Revisa los cortes de caja.
        </p>
      </Pantalla>
    );
  }
  if (turno === undefined || (turno && !datos)) return null;

  if (!turno) {
    return (
      <Pantalla titulo="Caja actual">
        <div className="flex flex-col gap-4 rounded-hoja bg-papel p-6">
          <h2 className="text-seccion font-semibold">La caja está cerrada</h2>
          <FormularioAbrirCaja />
        </div>
      </Pantalla>
    );
  }

  const resumen = resumirTurno({ turno, ...datos! });
  const aviso = avisoCajaAbierta(turno.dia, diaLocal());

  return (
    <Pantalla
      titulo="Caja actual"
      acciones={
        <>
          <Boton onClick={() => setRegistrando('entrada')}>Registrar entrada</Boton>
          <Boton onClick={() => setRegistrando('retiro')}>Registrar retiro</Boton>
          <Boton onClick={() => setRegistrando('gasto')}>Registrar gasto</Boton>
          <Boton variante="oscuro" onClick={() => navegar('/caja/cerrar')}>
            Cerrar caja
          </Boton>
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
      <div className="max-w-xl rounded-hoja bg-papel px-5 py-3">
        <TablaCifras
          filas={[
            ...filasTotalesTurno(resumen),
            ...(puede('verReportes')
              ? [
                  {
                    etiqueta: 'Efectivo esperado',
                    valor: formatearDinero(resumen.efectivoEsperado),
                    fuerte: true,
                  },
                ]
              : []),
          ]}
        />
      </div>
      {registrando && (
        <DialogoMovimiento turno={turno} tipo={registrando} alCerrar={() => setRegistrando(null)} />
      )}
    </Pantalla>
  );
}
