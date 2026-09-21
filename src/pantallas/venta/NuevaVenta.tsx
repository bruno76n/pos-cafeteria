import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Hoja } from '@/componentes/Hoja';
import { useTurnoAbierto } from '@/datos/consultas';
import { useDispositivoActual } from '@/estado/dispositivo';
import { FormularioAbrirCaja } from '@/pantallas/caja/FormularioAbrirCaja';

export function NuevaVenta() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const [abriendo, setAbriendo] = useState(false);
  if (turno === undefined) return null;

  if (!turno) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-seccion font-semibold">Abre la caja para empezar a vender.</p>
        <Boton variante="oscuro" tamano="grande" onClick={() => setAbriendo(true)}>
          Abrir caja
        </Boton>
        {abriendo && (
          <Hoja titulo="Abrir caja" centrada ancho="max-w-md" alCerrar={() => setAbriendo(false)}>
            <FormularioAbrirCaja alAbrir={() => setAbriendo(false)} />
          </Hoja>
        )}
      </div>
    );
  }

  return null;
}
