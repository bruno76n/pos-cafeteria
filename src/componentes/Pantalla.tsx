import type { ReactNode } from 'react';

/** Contenedor de una pantalla con título y acciones opcionales. */
export function Pantalla({
  titulo,
  acciones,
  children,
  className = '',
}: {
  titulo: string;
  acciones?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-pantalla font-bold">{titulo}</h1>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </header>
      {children}
    </section>
  );
}
