import type { ReactNode } from 'react';

/** Casilla de verificación grande (toda la fila se puede tocar). */
export function Casilla({
  marcada,
  alCambiar,
  deshabilitada,
  children,
}: {
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  deshabilitada?: boolean;
  /** Texto de la casilla (también es su nombre accesible). */
  children: ReactNode;
}) {
  return (
    <label
      className={`flex min-h-12 flex-1 items-center gap-3 ${deshabilitada ? 'opacity-40' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        className="size-6 shrink-0 accent-grafito"
        checked={marcada}
        disabled={deshabilitada}
        onChange={(e) => alCambiar(e.target.checked)}
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
