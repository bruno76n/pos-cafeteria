import { NavLink } from 'react-router';

export interface Pestana {
  a: string;
  texto: string;
  /** Solo activa con la ruta exacta. */
  exacta?: boolean;
}

/** Subsecciones como pestañas arriba del contenido. */
export function Pestanas({ pestanas }: { pestanas: Pestana[] }) {
  return (
    <nav aria-label="Subsecciones" className="flex shrink-0 gap-1 overflow-x-auto border-b border-linea px-4">
      {pestanas.map((p) => (
        <NavLink
          key={p.a}
          to={p.a}
          end={p.exacta}
          className={({ isActive }) =>
            `flex min-h-12 shrink-0 items-center border-b-3 px-4 font-semibold ${
              isActive ? 'border-grafito text-grafito' : 'border-transparent text-grafito-suave'
            }`
          }
        >
          {p.texto}
        </NavLink>
      ))}
    </nav>
  );
}
