import { Pantalla } from '@/componentes/Pantalla';
import { ConfigImpresora } from './Impresora';

export function ConfigDispositivo() {
  return (
    <Pantalla titulo="Dispositivo">
      <ConfigImpresora />
    </Pantalla>
  );
}
