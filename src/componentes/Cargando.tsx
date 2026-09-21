import type { ReactNode } from 'react';

/** Pantalla completa de espera (solo mientras se lee la base local o se hace el primer pull). */
export function Cargando({ mensaje = 'Cargando…', children }: { mensaje?: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center" role="status">
      <p className="text-seccion font-semibold text-grafito-suave">{mensaje}</p>
      {children}
    </div>
  );
}
