import { useState } from 'react';
import { aTextoCaptura, leerCaptura, type Centavos } from '@/dominio/dinero';
import { Campo, type PropsCampo } from './Campo';

/** Campo de dinero: el usuario escribe pesos ("12.5") y el valor se maneja en centavos. */
export function CampoDinero({
  valor,
  alCambiar,
  ...props
}: Omit<PropsCampo, 'value' | 'onChange'> & {
  valor: Centavos | null;
  alCambiar: (centavos: Centavos | null) => void;
}) {
  const [texto, setTexto] = useState(valor === null ? '' : aTextoCaptura(valor));
  return (
    <Campo
      inputMode="decimal"
      autoComplete="off"
      placeholder="0.00"
      {...props}
      className={`cifras ${props.className ?? ''}`}
      value={texto}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
        setTexto(t);
        alCambiar(t === '' ? null : leerCaptura(t));
      }}
    />
  );
}
