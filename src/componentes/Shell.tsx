import { Outlet } from 'react-router';
import { BarraSuperior } from './BarraSuperior';
import { BarraInferior, Riel } from './Navegacion';

/** Estructura general: barra superior, riel lateral (o barra inferior en vertical) y contenido. */
export function Shell() {
  return (
    <div className="flex h-full flex-col">
      <BarraSuperior />
      <div className="flex min-h-0 flex-1">
        <Riel />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <BarraInferior />
    </div>
  );
}
