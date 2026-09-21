import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Segmentos } from '@/componentes/Segmentos';
import type { NuevoPago } from '@/dominio/cobro';
import type { Centavos } from '@/dominio/dinero';
import type { CuentaBancaria } from '@/dominio/tipos';

/** CLABE en grupos de 4 para dictarla fácil. */
const enGrupos = (texto: string) => texto.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ');

/** Datos bancarios, monto, referencia y "Marcar como pagada". */
export function PanelTransferencia({
  pendiente,
  cuentas,
  referenciaObligatoria,
  alPagar,
}: {
  pendiente: Centavos;
  cuentas: CuentaBancaria[];
  referenciaObligatoria: boolean;
  alPagar: (pago: NuevoPago) => void;
}) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [monto, setMonto] = useState<Centavos | null>(pendiente);
  const [referencia, setReferencia] = useState('');
  const cuenta = cuentas.find((c) => c.id === cuentaId);

  return (
    <div className="flex flex-col gap-4">
      {cuentas.length > 1 && (
        <Segmentos
          etiqueta="Cuenta"
          valor={cuentaId}
          alCambiar={setCuentaId}
          opciones={cuentas.map((c) => ({ valor: c.id, texto: c.alias || c.banco }))}
        />
      )}
      {cuenta ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-boton border border-linea bg-papel p-4">
          <dt className="text-grafito-suave">Banco</dt>
          <dd className="font-semibold">{cuenta.banco}</dd>
          <dt className="text-grafito-suave">Titular</dt>
          <dd className="font-semibold">{cuenta.titular}</dd>
          {cuenta.clabe && (
            <>
              <dt className="text-grafito-suave">CLABE</dt>
              <dd className="cifras text-seccion font-semibold tracking-wide">{enGrupos(cuenta.clabe)}</dd>
            </>
          )}
          {cuenta.cuenta && (
            <>
              <dt className="text-grafito-suave">Cuenta o tarjeta</dt>
              <dd className="cifras text-seccion font-semibold tracking-wide">{enGrupos(cuenta.cuenta)}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="rounded-boton bg-ambar-fondo p-3 text-ambar">
          No hay cuentas bancarias configuradas. Agrégalas en Configuración › Pagos.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoDinero etiqueta="Monto" valor={monto} alCambiar={setMonto} />
        <Campo
          etiqueta={referenciaObligatoria ? 'Referencia' : 'Referencia (opcional)'}
          value={referencia}
          maxLength={40}
          onChange={(e) => setReferencia(e.target.value)}
        />
      </div>
      <Boton
        variante="dinero"
        tamano="enorme"
        disabled={!monto}
        onClick={() => monto && alPagar({ metodo: 'transferencia', monto, referencia, cuentaId: cuenta?.id })}
      >
        Marcar como pagada
      </Boton>
    </div>
  );
}
