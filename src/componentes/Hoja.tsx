import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hoja que sube desde abajo (máx. 760 px de ancho) o diálogo centrado.
 * Se cierra con Escape, con la X o tocando el fondo.
 */
export function Hoja({
  titulo,
  alCerrar,
  children,
  pie,
  centrada = false,
  ancho = 'max-w-[760px]',
  encabezado,
}: {
  titulo: string;
  alCerrar?: () => void;
  children: ReactNode;
  pie?: ReactNode;
  centrada?: boolean;
  ancho?: string;
  /** Contenido extra junto al título (p. ej. el precio). */
  encabezado?: ReactNode;
}) {
  const idTitulo = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero = panel.current?.querySelector<HTMLElement>(
      '[autofocus], input, button:not([data-cerrar])',
    );
    (primero ?? panel.current)?.focus();
    return () => previo?.focus?.();
  }, []);

  useEffect(() => {
    if (!alCerrar) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  return createPortal(
    <div
      className={`fixed inset-0 z-40 flex bg-grafito/40 ${centrada ? 'items-center justify-center p-4' : 'items-end justify-center'}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) alCerrar?.();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full ${ancho} flex-col bg-papel shadow-xl focus:outline-none ${
          centrada ? 'animate-aparecer rounded-hoja' : 'animate-subir rounded-t-hoja'
        }`}
      >
        <header className="flex items-center gap-3 border-b border-linea px-4 py-3">
          <h2 id={idTitulo} className="flex-1 text-seccion font-semibold">
            {titulo}
          </h2>
          {encabezado}
          {alCerrar && (
            <button
              type="button"
              data-cerrar
              aria-label="Cerrar"
              onClick={alCerrar}
              className="flex size-12 items-center justify-center rounded-boton text-grafito active:bg-acero"
            >
              <X aria-hidden />
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {pie && <footer className="border-t border-linea p-4">{pie}</footer>}
      </div>
    </div>,
    document.body,
  );
}
