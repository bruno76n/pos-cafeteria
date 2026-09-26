import { Printer } from 'lucide-react';
import { Boton } from '@/componentes/Boton';
import { Pantalla } from '@/componentes/Pantalla';
import { useConfig } from '@/datos/consultas';
import type { Turno } from '@/dominio/tipos';
import { VistaTicket } from '@/impresion/html';
import { construirTicketCorte } from '@/impresion/ticket';
import { useImpresora } from '@/impresion/usarImpresora';
import { textoDiferencia } from './diferencia';

/** Paso final del cierre: "Caja cerrada. Diferencia: …" e "Imprimir corte". */
export function CorteCerrado({ turno, alSalir }: { turno: Turno; alSalir: () => void }) {
  const config = useConfig();
  const { imprimir, error, imprimiendo, columnas } = useImpresora();
  const diferencia = textoDiferencia(turno.resumen?.diferencia ?? 0);
  const doc = config && turno.resumen ? construirTicketCorte(turno, config, { columnas }) : null;

  return (
    <Pantalla titulo="Caja cerrada">
      <p className="text-seccion" role="status">
        Caja cerrada. Diferencia:{' '}
        <span
          className={`font-bold ${diferencia.tono === 'faltante' ? 'text-faltante' : diferencia.tono === 'cafeto' ? 'text-cafeto' : ''}`}
        >
          {diferencia.texto.toLocaleLowerCase('es-MX')}
        </span>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton
          variante="oscuro"
          tamano="grande"
          disabled={!doc || imprimiendo}
          onClick={() => doc && imprimir(doc)}
        >
          <Printer aria-hidden /> {error ? 'Reintentar' : 'Imprimir corte'}
        </Boton>
        <Boton tamano="grande" onClick={alSalir}>
          Ir a Caja
        </Boton>
      </div>
      {error && (
        <p className="text-faltante" role="alert">
          {error}
        </p>
      )}
      {doc && <VistaTicket doc={doc} className="self-start" />}
    </Pantalla>
  );
}
