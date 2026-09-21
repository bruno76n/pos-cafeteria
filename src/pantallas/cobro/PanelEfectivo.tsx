import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { aplicarTecla, TecladoNumerico } from '@/componentes/TecladoNumerico';
import { billetesSugeridos, type NuevoPago } from '@/dominio/cobro';
import { formatearDinero, formatearDineroCorto, type Centavos } from '@/dominio/dinero';

/** Exacto, billetes rápidos o teclado; muestra el cambio. "Confirmar cobro" si cubre, si no "Agregar pago". */
export function PanelEfectivo({
  pendiente,
  alPagar,
}: {
  pendiente: Centavos;
  alPagar: (pago: NuevoPago) => void;
}) {
  const [recibido, setRecibido] = useState<Centavos | null>(null);
  const [tecleado, setTecleado] = useState('');
  const cubre = recibido !== null && recibido >= pendiente;
  const cambio = recibido !== null ? Math.max(0, recibido - pendiente) : 0;

  const elegir = (monto: Centavos) => {
    setRecibido(monto);
    setTecleado('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-seccion text-grafito-suave">Recibido</span>
        <span className="cifras text-total font-extrabold" aria-live="polite">
          {recibido === null ? '—' : formatearDinero(recibido)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Boton tamano="grande" aria-pressed={recibido === pendiente} onClick={() => elegir(pendiente)}>
          Exacto
        </Boton>
        {billetesSugeridos(pendiente).map((b) => (
          <Boton
            key={b}
            tamano="grande"
            aria-pressed={recibido === b}
            className="cifras"
            onClick={() => elegir(b)}
          >
            {formatearDineroCorto(b)}
          </Boton>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-6">
        <TecladoNumerico
          alTecla={(t) => {
            const texto = aplicarTecla(tecleado, t);
            setTecleado(texto);
            setRecibido(texto ? Number(texto) * 100 : null);
          }}
        />
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-seccion text-grafito-suave">Cambio</span>
          <span className="cifras text-[48px] leading-none font-extrabold" aria-live="polite">
            {formatearDinero(cambio)}
          </span>
        </div>
      </div>
      <Boton
        variante="dinero"
        tamano="enorme"
        disabled={!recibido}
        onClick={() => recibido && alPagar({ metodo: 'efectivo', monto: recibido })}
      >
        {cubre || !recibido ? 'Confirmar cobro' : 'Agregar pago'}
      </Boton>
    </div>
  );
}
