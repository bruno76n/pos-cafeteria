import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { useSeccionesPermitidas } from '@/estado/secciones';
import { SECCIONES_BARRA_INFERIOR, type Seccion } from '@/secciones';
import { Hoja } from './Hoja';

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-1 rounded-boton px-1 py-2 text-[12px] font-semibold leading-tight ${
    isActive ? 'bg-grafito text-papel' : 'text-grafito-suave active:bg-linea/60'
  }`;

function Enlace({ s, alTocar }: { s: Seccion; alTocar?: () => void }) {
  const Icono = s.icono;
  return (
    <NavLink to={s.ruta.split('/').slice(0, 2).join('/')} className={claseEnlace} onClick={alTocar}>
      <Icono aria-hidden size={24} />
      <span>{s.nombre}</span>
    </NavLink>
  );
}

/** Riel lateral (80 px) en horizontal. */
export function Riel() {
  const secciones = useSeccionesPermitidas();
  return (
    <nav
      aria-label="Secciones"
      className="flex w-20 shrink-0 flex-col gap-1 overflow-y-auto border-r border-linea bg-papel p-2 portrait:hidden"
    >
      {secciones.map((s) => (
        <Enlace key={s.id} s={s} />
      ))}
    </nav>
  );
}

/** Barra inferior en vertical y celular: cinco accesos, el resto en "Más". */
export function BarraInferior() {
  const secciones = useSeccionesPermitidas();
  const [masAbierto, setMasAbierto] = useState(false);
  const principales = secciones.filter((s) => SECCIONES_BARRA_INFERIOR.includes(s.id));
  const resto = secciones.filter((s) => !SECCIONES_BARRA_INFERIOR.includes(s.id));
  return (
    <nav aria-label="Secciones" className="hidden border-t border-linea bg-papel p-1 portrait:flex">
      <div className="grid flex-1 auto-cols-fr grid-flow-col gap-1">
        {principales.map((s) => (
          <Enlace key={s.id} s={s} />
        ))}
        {resto.length > 0 && (
          <button
            type="button"
            className={claseEnlace({ isActive: false })}
            onClick={() => setMasAbierto(true)}
          >
            <Ellipsis aria-hidden size={24} />
            <span>Más</span>
          </button>
        )}
      </div>
      {masAbierto && (
        <Hoja titulo="Más secciones" alCerrar={() => setMasAbierto(false)}>
          <div className="grid grid-cols-3 gap-2">
            {resto.map((s) => (
              <Enlace key={s.id} s={s} alTocar={() => setMasAbierto(false)} />
            ))}
          </div>
        </Hoja>
      )}
    </nav>
  );
}
