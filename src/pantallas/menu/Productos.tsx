import { ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { clasesEntrada } from '@/componentes/Campo';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { useCategorias, useProductos } from '@/datos/consultas';
import { cargarMenuDeEjemplo, guardar, guardarVarios } from '@/datos/escrituras';
import { formatearDinero } from '@/dominio/dinero';
import { mover } from '@/dominio/orden';
import { coincide } from '@/dominio/texto';
import { useUsuarioActivo } from '@/estado/sesion';

/** Lista de productos con buscador, filtro por categoría, disponible y orden dentro de su categoría. */
export function Productos() {
  const categorias = useCategorias();
  const productos = useProductos();
  const { puede } = useUsuarioActivo();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const editaMenu = puede('crearProductos');

  const visibles = useMemo(() => {
    if (!productos || !categorias) return [];
    const ordenCategoria = new Map(categorias.map((c) => [c.id, c.orden]));
    return productos
      .filter((p) => (!categoriaId || p.categoriaId === categoriaId) && coincide(p.nombre, busqueda))
      .sort(
        (a, b) =>
          (ordenCategoria.get(a.categoriaId) ?? 99) - (ordenCategoria.get(b.categoriaId) ?? 99) ||
          a.orden - b.orden,
      );
  }, [productos, categorias, categoriaId, busqueda]);

  if (!productos || !categorias) return null;
  const categoria = (id: string) => categorias.find((c) => c.id === id);
  const deSuCategoria = (id: string) => productos.filter((p) => p.categoriaId === id);

  return (
    <Pantalla
      titulo="Productos"
      acciones={
        editaMenu && (
          <Link to="/menu/productos/nuevo" className={clasesBoton('oscuro')}>
            <Plus aria-hidden /> Agregar producto
          </Link>
        )
      }
    >
      {productos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-seccion">Aún no hay productos.</p>
          {editaMenu && (
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/menu/productos/nuevo" className={clasesBoton('oscuro', 'grande')}>
                Agregar producto
              </Link>
              <Boton tamano="grande" onClick={() => void cargarMenuDeEjemplo()}>
                Cargar menú de ejemplo
              </Boton>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              aria-label="Buscar producto"
              placeholder="Buscar…"
              className={`${clasesEntrada} max-w-64`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {[{ id: null, nombre: 'Todas' }, ...categorias].map((c) => (
              <button
                key={c.id ?? 'todas'}
                type="button"
                aria-pressed={categoriaId === c.id}
                onClick={() => setCategoriaId(c.id)}
                className={`min-h-12 rounded-boton border px-4 font-semibold ${
                  categoriaId === c.id ? 'border-grafito bg-grafito text-papel' : 'border-linea bg-papel'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
          <ul className="flex flex-col rounded-hoja border border-linea bg-papel">
            {visibles.map((p) => {
              const hermanos = deSuCategoria(p.categoriaId).sort((a, b) => a.orden - b.orden);
              const posicion = hermanos.findIndex((x) => x.id === p.id);
              return (
                <li
                  key={p.id}
                  className="flex min-h-16 flex-wrap items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0"
                >
                  {p.imagen ? (
                    <img src={p.imagen} alt="" className="size-12 rounded-boton object-cover" />
                  ) : (
                    <span
                      aria-hidden
                      className="size-12 rounded-boton"
                      style={{ background: categoria(p.categoriaId)?.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.nombre}</span>
                    <span className="text-etiqueta text-grafito-suave">
                      {categoria(p.categoriaId)?.nombre ?? 'Sin categoría'}
                    </span>
                  </span>
                  <span className="cifras w-24 text-right font-semibold">{formatearDinero(p.precio)}</span>
                  <span className="flex items-center gap-2 text-etiqueta text-grafito-suave">
                    Disponible
                    <Interruptor
                      soloInterruptor
                      etiqueta={`${p.nombre} disponible`}
                      activo={p.disponible}
                      deshabilitado={!editaMenu}
                      alCambiar={(disponible) => void guardar('productos', { ...p, disponible })}
                    />
                  </span>
                  {editaMenu && (
                    <>
                      <Boton
                        className="w-12 px-0"
                        aria-label={`Subir ${p.nombre}`}
                        disabled={posicion <= 0}
                        onClick={() => void guardarVarios('productos', mover(hermanos, p.id, -1))}
                      >
                        <ChevronUp aria-hidden size={28} />
                      </Boton>
                      <Boton
                        className="w-12 px-0"
                        aria-label={`Bajar ${p.nombre}`}
                        disabled={posicion === hermanos.length - 1}
                        onClick={() => void guardarVarios('productos', mover(hermanos, p.id, 1))}
                      >
                        <ChevronDown aria-hidden size={28} />
                      </Boton>
                    </>
                  )}
                  <Link
                    to={`/menu/productos/${p.id}`}
                    className={clasesBoton('fantasma')}
                    aria-label={`Editar ${p.nombre}`}
                  >
                    <Pencil aria-hidden size={18} /> Editar
                  </Link>
                </li>
              );
            })}
            {visibles.length === 0 && (
              <li className="p-8 text-center text-grafito-suave">No hay productos con ese filtro.</li>
            )}
          </ul>
        </>
      )}
    </Pantalla>
  );
}
