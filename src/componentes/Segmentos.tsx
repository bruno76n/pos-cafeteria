export interface Segmento<T extends string> {
  valor: T;
  texto: string;
}

/** Selector de una opción entre pocas (botones juntos). La elegida en Grafito. */
export function Segmentos<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: Segmento<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-etiqueta text-grafito-suave">{etiqueta}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={o.valor === valor}
            onClick={() => alCambiar(o.valor)}
            className={`min-h-12 rounded-boton border px-4 font-semibold ${
              o.valor === valor
                ? 'border-grafito bg-grafito text-papel'
                : 'border-linea bg-papel text-grafito'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
