import type { ReactNode } from 'react';
import { Boton, type VarianteBoton } from './Boton';
import { Hoja } from './Hoja';

/** Diálogo de confirmación con dos botones: la acción y "conservar" (cancelar). */
export function Confirmar({
  titulo,
  children,
  textoAccion,
  textoCancelar,
  variante = 'peligro',
  alConfirmar,
  alCancelar,
}: {
  titulo: string;
  children?: ReactNode;
  textoAccion: string;
  textoCancelar: string;
  variante?: VarianteBoton;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <Hoja
      titulo={titulo}
      centrada
      ancho="max-w-md"
      alCerrar={alCancelar}
      pie={
        <div className="flex justify-end gap-2">
          <Boton tamano="grande" onClick={alCancelar}>
            {textoCancelar}
          </Boton>
          <Boton tamano="grande" variante={variante} onClick={alConfirmar}>
            {textoAccion}
          </Boton>
        </div>
      }
    >
      {children}
    </Hoja>
  );
}
