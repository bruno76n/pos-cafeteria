import { Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { textoPrecio } from '@/dominio/personalizacion';
import { coincide } from '@/dominio/texto';
import type { Categoria, Producto } from '@/dominio/tipos';

const PULSACION_LARGA_MS = 600;

/**
 * Botón de producto: nombre, precio ("Desde $55.00" si tiene tamaños) y franja del color de su categoría. Con `alMantener`,
 * una pulsación larga (o clic secundario) llama a esa acción en lugar de agregar.
 */
export function BotonProducto({
  producto,
  color,
  alTocar,
  alMantener,
}: {
  producto: Producto;
  color: string;
  alTocar: () => void;
  alMantener?: () => void;
}) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mantenido = useRef(false);
  const cancelar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  const mantener = () => {
    cancelar();
    mantenido.current = true;
    alMantener?.();
  };

  return (
    <button
      type="button"
      aria-disabled={!producto.disponible}
      onPointerDown={() => {
        mantenido.current = false;
        if (alMantener) temporizador.current = setTimeout(mantener, PULSACION_LARGA_MS);
      }}
      onPointerUp={cancelar}
      onPointerLeave={cancelar}
      onPointerCancel={cancelar}
      onContextMenu={(e) => {
        if (!alMantener) return;
        e.preventDefault();
        if (!mantenido.current) mantener();
      }}
      onClick={() => {
        if (mantenido.current) {
          mantenido.current = false;
          return;
        }
        if (producto.disponible) alTocar();
      }}
      style={{ borderLeftColor: color }}
      className={`relative flex h-26 select-none flex-col justify-between overflow-hidden rounded-boton border border-l-6 border-linea bg-papel p-3 text-left transition-transform duration-100 [-webkit-touch-callout:none] ${
        producto.disponible ? 'active:scale-[0.98] active:bg-acero' : 'opacity-40'
      }`}
    >
      <span className="flex gap-2">
        <span className="line-clamp-2 flex-1 text-producto font-semibold leading-tight">
          {producto.nombre}
        </span>
        {producto.imagen && (
          <img src={producto.imagen} alt="" className="size-10 shrink-0 rounded-md object-cover" />
        )}
      </span>
      <span className="cifras text-grafito-suave">
        {producto.disponible ? textoPrecio(producto) : 'No disponible'}
      </span>
    </button>
  );
}

/** Pestañas de categoría, buscador sin acentos y cuadrícula de productos. */
export function Catalogo({
  categorias,
  productos,
  alTocarProducto,
  alMantenerProducto,
}: {
  categorias: Categoria[];
  productos: Producto[];
  alTocarProducto: (producto: Producto) => void;
  /** Pulsación larga: marcar disponible / no disponible. */
  alMantenerProducto?: (producto: Producto) => void;
}) {
  const activas = useMemo(() => categorias.filter((c) => c.activa), [categorias]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const categoriaId = activas.some((c) => c.id === elegida) ? elegida : (activas[0]?.id ?? null);
  const porId = useMemo(() => new Map(activas.map((c) => [c.id, c])), [activas]);

  const visibles = useMemo(() => {
    const deCategoriaActiva = productos.filter((p) => porId.has(p.categoriaId));
    if (busqueda.trim()) {
      return deCategoriaActiva
        .filter((p) => coincide(p.nombre, busqueda))
        .sort(
          (a, b) => porId.get(a.categoriaId)!.orden - porId.get(b.categoriaId)!.orden || a.orden - b.orden,
        );
    }
    return deCategoriaActiva.filter((p) => p.categoriaId === categoriaId);
  }, [productos, porId, busqueda, categoriaId]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Productos">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 max-sm:flex-col max-sm:items-stretch">
        <div role="tablist" aria-label="Categorías" className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {activas.map((c) => {
            const actual = !busqueda.trim() && c.id === categoriaId;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={actual}
                onClick={() => {
                  setElegida(c.id);
                  setBusqueda('');
                }}
                className={`min-h-14 shrink-0 rounded-boton border px-5 text-producto font-semibold ${
                  actual ? 'border-grafito bg-grafito text-papel' : 'border-linea bg-papel text-grafito'
                }`}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>
        <label className="relative flex w-52 shrink-0 items-center max-sm:order-first max-sm:w-full">
          <Search aria-hidden size={20} className="pointer-events-none absolute left-3 text-grafito-suave" />
          <input
            type="search"
            aria-label="Buscar producto"
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-h-14 w-full rounded-boton border border-linea bg-papel pr-12 pl-10 focus:border-grafito [&::-webkit-search-cancel-button]:hidden"
          />
          {busqueda && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setBusqueda('')}
              className="absolute right-1 flex size-12 items-center justify-center text-grafito-suave"
            >
              <X aria-hidden size={20} />
            </button>
          )}
        </label>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 overflow-y-auto px-4 pb-4">
        {visibles.map((p) => (
          <BotonProducto
            key={p.id}
            producto={p}
            color={porId.get(p.categoriaId)?.color ?? '#5E6B73'}
            alTocar={() => alTocarProducto(p)}
            alMantener={alMantenerProducto && (() => alMantenerProducto(p))}
          />
        ))}
        {visibles.length === 0 && (
          <p className="col-span-full p-8 text-center text-grafito-suave">
            {busqueda.trim()
              ? `No hay productos que digan «${busqueda.trim()}».`
              : 'Aún no hay productos en esta categoría.'}
          </p>
        )}
      </div>
    </section>
  );
}
