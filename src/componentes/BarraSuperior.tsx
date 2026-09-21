import { Lock, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useConfig } from '@/datos/consultas';
import { NOMBRE_ROL } from '@/dominio/permisos';
import { useDispositivoActual } from '@/estado/dispositivo';
import { useSesion, useUsuarioActivo } from '@/estado/sesion';
import { IndicadorConexion } from './IndicadorConexion';

export function BarraSuperior() {
  const config = useConfig();
  const dispositivo = useDispositivoActual();
  const { usuario } = useUsuarioActivo();
  const bloquear = useSesion((s) => s.bloquear);
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-linea bg-papel px-4">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate font-semibold">{config?.negocio.nombre}</span>
        {dispositivo && (
          <span className="truncate text-etiqueta text-grafito-suave">{dispositivo.nombre}</span>
        )}
      </div>
      <IndicadorConexion />
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((a) => !a)}
          className="flex min-h-12 items-center gap-2 rounded-boton px-3 font-semibold active:bg-acero"
        >
          <UserRound aria-hidden size={20} />
          <span className="max-w-40 truncate">{usuario?.nombre}</span>
        </button>
        {menuAbierto && (
          <>
            <div className="fixed inset-0 z-30" onPointerDown={() => setMenuAbierto(false)} />
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-boton border border-linea bg-papel shadow-lg"
            >
              {usuario && (
                <p className="border-b border-linea px-4 py-3 text-etiqueta text-grafito-suave">
                  {usuario.nombre} · {NOMBRE_ROL[usuario.rol]}
                </p>
              )}
              <button
                type="button"
                role="menuitem"
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-acero"
                onClick={bloquear}
              >
                <UserRound aria-hidden size={20} /> Cambiar usuario
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-acero"
                onClick={bloquear}
              >
                <Lock aria-hidden size={20} /> Bloquear
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
