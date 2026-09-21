import { Delete } from 'lucide-react';

export type TeclaNumerica = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | 'borrar';

const TECLAS: TeclaNumerica[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', 'borrar'];

/** Teclado numérico con teclas de 64 px (7 8 9 / 4 5 6 / 1 2 3 / 0 00 ⌫). */
export function TecladoNumerico({ alTecla }: { alTecla: (tecla: TeclaNumerica) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TECLAS.map((t) => (
        <button
          key={t}
          type="button"
          aria-label={t === 'borrar' ? 'Borrar' : t}
          onClick={() => alTecla(t)}
          className="flex min-h-16 items-center justify-center rounded-boton border border-linea bg-papel text-pantalla font-semibold active:scale-[0.98] active:bg-acero"
        >
          {t === 'borrar' ? <Delete aria-hidden /> : t}
        </button>
      ))}
    </div>
  );
}

/** Aplica una tecla a un monto capturado en pesos enteros ("2", "20", "200"). */
export function aplicarTecla(texto: string, tecla: TeclaNumerica): string {
  if (tecla === 'borrar') return texto.slice(0, -1);
  const nuevo = (texto + tecla).replace(/^0+(?=\d)/, '');
  return nuevo.length > 6 ? texto : nuevo;
}
