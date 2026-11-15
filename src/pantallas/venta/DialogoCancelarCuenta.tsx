import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Hoja } from '@/componentes/Hoja';
import { etiquetaCuenta } from '@/dominio/cuentas';
import type { Cuenta } from '@/dominio/tipos';

/** Cancelar una cuenta abierta. Con pedidos pide motivo; si ya se mandó a cocina, ofrece avisar. */
export function DialogoCancelarCuenta({
  cuenta,
  tienePedidos,
  ofreceAviso,
  alCancelar,
  alCerrar,
}: {
  cuenta: Pick<Cuenta, 'numero' | 'nombre'>;
  tienePedidos: boolean;
  /** Hay productos de cocina y la comanda está activada. */
  ofreceAviso: boolean;
  alCancelar: (motivo: string, avisarACocina: boolean) => void;
  alCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  function cancelar(avisar: boolean) {
    if (tienePedidos && !motivo.trim()) return setError('Escribe el motivo.');
    alCancelar(motivo, avisar);
  }

  return (
    <Hoja
      titulo={`Cancelar ${etiquetaCuenta(cuenta)}`}
      centrada
      ancho="max-w-md"
      alCerrar={alCerrar}
      pie={
        <div className="flex flex-wrap justify-end gap-2">
          <Boton tamano="grande" onClick={alCerrar}>
            Volver
          </Boton>
          <Boton tamano="grande" variante="peligro" onClick={() => cancelar(false)}>
            Cancelar cuenta
          </Boton>
          {ofreceAviso && (
            <Boton tamano="grande" variante="oscuro" onClick={() => cancelar(true)}>
              Cancelar y avisar a cocina
            </Boton>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {ofreceAviso && (
          <p className="rounded-boton bg-ambar-fondo p-3 text-ambar">
            Esta cuenta ya se mandó a cocina. Avisa en barra que no la preparen.
          </p>
        )}
        {tienePedidos ? (
          <Campo
            etiqueta="Motivo"
            value={motivo}
            maxLength={120}
            error={error}
            onChange={(e) => setMotivo(e.target.value)}
          />
        ) : (
          <p>La cuenta no tiene pedidos; se descarta.</p>
        )}
      </div>
    </Hoja>
  );
}
