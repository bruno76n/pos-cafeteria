import { Boton } from '@/componentes/Boton';
import { Hoja } from '@/componentes/Hoja';
import { nombreLinea } from '@/dominio/personalizacion';
import type { LineaVenta } from '@/dominio/tipos';

/** Anular una línea ya enviada: una pieza o todas. Cocina recibe un aviso. */
export function DialogoAnular({
  linea,
  alAnular,
  alCerrar,
}: {
  linea: LineaVenta;
  alAnular: (cantidad: number) => void;
  alCerrar: () => void;
}) {
  const nombre = nombreLinea(linea);
  return (
    <Hoja
      titulo={`Anular ${nombre}`}
      centrada
      ancho="max-w-md"
      alCerrar={alCerrar}
      pie={
        <div className="flex flex-wrap justify-end gap-2">
          <Boton tamano="grande" onClick={alCerrar}>
            Volver
          </Boton>
          <Boton tamano="grande" variante="peligro" onClick={() => alAnular(1)}>
            Anular 1
          </Boton>
          {linea.cantidad > 1 && (
            <Boton tamano="grande" variante="peligro" onClick={() => alAnular(linea.cantidad)}>
              Anular todas ({linea.cantidad})
            </Boton>
          )}
        </div>
      }
    >
      <p>
        {linea.cantidad > 1 ? `Hay ${linea.cantidad} en la cuenta.` : `Anular 1x ${nombre}.`} Cocina recibirá
        un aviso.
      </p>
    </Hoja>
  );
}
