import { useId } from 'react';

/** Interruptor sí/no con etiqueta (toda la fila se puede tocar). */
export function Interruptor({
  etiqueta,
  descripcion,
  activo,
  alCambiar,
  deshabilitado,
  soloInterruptor = false,
}: {
  etiqueta: string;
  descripcion?: string;
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  deshabilitado?: boolean;
  /** Oculta el texto (queda como aria-label), para usarlo dentro de tablas. */
  soloInterruptor?: boolean;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={soloInterruptor ? etiqueta : undefined}
      aria-describedby={descripcion ? id : undefined}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className={`flex min-h-12 items-center gap-3 text-left disabled:opacity-40 ${soloInterruptor ? '' : 'w-full'}`}
    >
      {!soloInterruptor && (
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">{etiqueta}</span>
          {descripcion && (
            <span id={id} className="text-etiqueta text-grafito-suave">
              {descripcion}
            </span>
          )}
        </span>
      )}
      <span
        aria-hidden
        className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors ${activo ? 'bg-grafito' : 'bg-linea'}`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-papel transition-transform ${activo ? 'translate-x-7' : 'translate-x-1'}`}
        />
      </span>
    </button>
  );
}
