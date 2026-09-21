import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import type { NuevoPago } from '@/dominio/cobro';
import type { Centavos } from '@/dominio/dinero';

/** Monto (por defecto el pendiente), referencia opcional y "Pagado con tarjeta". */
export function PanelTarjeta({
  pendiente,
  alPagar,
}: {
  pendiente: Centavos;
  alPagar: (pago: NuevoPago) => void;
}) {
  const [monto, setMonto] = useState<Centavos | null>(pendiente);
  const [referencia, setReferencia] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-grafito-suave">Cobra en la terminal y confirma aquí.</p>
      <CampoDinero etiqueta="Monto" valor={monto} alCambiar={setMonto} />
      <Campo
        etiqueta="Referencia (opcional)"
        placeholder="Últimos 4 dígitos o autorización"
        value={referencia}
        maxLength={30}
        onChange={(e) => setReferencia(e.target.value)}
      />
      <Boton
        variante="dinero"
        tamano="enorme"
        disabled={!monto}
        onClick={() => monto && alPagar({ metodo: 'tarjeta', monto, referencia })}
      >
        Pagado con tarjeta
      </Boton>
    </div>
  );
}
