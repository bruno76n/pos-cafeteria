import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string | null;
  ayuda?: ReactNode;
}

export const clasesEntrada =
  'min-h-12 w-full rounded-boton border border-linea bg-papel px-3 text-normal text-grafito placeholder:text-grafito-suave/70 focus:border-grafito focus:outline-none disabled:bg-acero aria-invalid:border-faltante';

export function Campo({ etiqueta, error, ayuda, id, className = '', ...props }: PropsCampo) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={idCampo} className="text-etiqueta text-grafito-suave">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        className={clasesEntrada}
        {...props}
      />
      {ayuda && !error && <p className="text-etiqueta text-grafito-suave">{ayuda}</p>}
      {error && (
        <p id={`${idCampo}-error`} className="text-etiqueta text-faltante">
          {error}
        </p>
      )}
    </div>
  );
}
