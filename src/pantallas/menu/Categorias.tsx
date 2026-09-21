import { ChevronDown, ChevronUp, Pencil, Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Confirmar } from '@/componentes/Confirmar';
import { Hoja } from '@/componentes/Hoja';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { RequierePermiso } from '@/componentes/RequierePermiso';
import { useCategorias, useProductos } from '@/datos/consultas';
import { borrar, guardar, guardarVarios } from '@/datos/escrituras';
import { mover, siguienteOrden } from '@/dominio/orden';
import type { Categoria } from '@/dominio/tipos';
import { COLORES_CATEGORIA } from './colores';

type SinFecha = Omit<Categoria, 'actualizadoEn'>;

function FormularioCategoria({
  inicial,
  alGuardar,
  alCerrar,
}: {
  inicial: SinFecha;
  alGuardar: (c: SinFecha) => Promise<void>;
  alCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [color, setColor] = useState(inicial.color);
  const [error, setError] = useState<string | null>(null);
  return (
    <Hoja
      titulo={inicial.nombre ? 'Editar categoría' : 'Nueva categoría'}
      centrada
      ancho="max-w-lg"
      alCerrar={alCerrar}
      pie={
        <div className="flex justify-end">
          <Boton
            variante="oscuro"
            tamano="grande"
            onClick={async () => {
              if (!nombre.trim()) return setError('Escribe el nombre.');
              await alGuardar({ ...inicial, nombre: nombre.trim(), color });
            }}
          >
            Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre"
          value={nombre}
          maxLength={30}
          onChange={(e) => setNombre(e.target.value)}
          error={error}
        />
        <fieldset>
          <legend className="mb-2 text-etiqueta text-grafito-suave">Color</legend>
          <div className="grid grid-cols-4 gap-2">
            {COLORES_CATEGORIA.map((c) => (
              <button
                key={c.valor}
                type="button"
                aria-pressed={color === c.valor}
                onClick={() => setColor(c.valor)}
                className={`flex min-h-12 items-center gap-2 rounded-boton border px-2 ${
                  color === c.valor ? 'border-grafito ring-2 ring-grafito' : 'border-linea'
                }`}
              >
                <span aria-hidden className="size-5 rounded-full" style={{ background: c.valor }} />
                {c.nombre}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Hoja>
  );
}

/** Categorías: crear, editar (nombre y color), ordenar, activar/desactivar y eliminar si no tiene productos. */
export function Categorias() {
  const categorias = useCategorias();
  const productos = useProductos();
  const [editando, setEditando] = useState<SinFecha | null>(null);
  const [eliminando, setEliminando] = useState<Categoria | null>(null);
  if (!categorias || !productos) return null;
  const cuantos = (id: string) => productos.filter((p) => p.categoriaId === id).length;

  return (
    <RequierePermiso permiso="crearProductos">
      <Pantalla
        titulo="Categorías"
        acciones={
          <Boton
            variante="oscuro"
            onClick={() =>
              setEditando({
                id: crypto.randomUUID(),
                nombre: '',
                color: COLORES_CATEGORIA[categorias.length % COLORES_CATEGORIA.length]!.valor,
                orden: siguienteOrden(categorias),
                activa: true,
              })
            }
          >
            <Plus aria-hidden /> Nueva categoría
          </Boton>
        }
      >
        {categorias.length === 0 ? (
          <p className="p-8 text-center text-grafito-suave">Aún no hay categorías.</p>
        ) : (
          <ul className="flex flex-col rounded-hoja bg-papel">
            {categorias.map((c, i) => (
              <li
                key={c.id}
                className="flex min-h-16 flex-wrap items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0"
              >
                <span aria-hidden className="h-10 w-1.5 rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1">
                  <span className="text-producto font-semibold">{c.nombre}</span>
                  <span className="ml-2 text-etiqueta text-grafito-suave">
                    {cuantos(c.id)} {cuantos(c.id) === 1 ? 'producto' : 'productos'}
                  </span>
                </span>
                <Interruptor
                  etiqueta={`${c.nombre} activa`}
                  soloInterruptor
                  activo={c.activa}
                  alCambiar={(activa) => void guardar('categorias', { ...c, activa })}
                />
                <Boton
                  className="w-12 px-0"
                  aria-label={`Subir ${c.nombre}`}
                  disabled={i === 0}
                  onClick={() => void guardarVarios('categorias', mover(categorias, c.id, -1))}
                >
                  <ChevronUp aria-hidden size={28} />
                </Boton>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Bajar ${c.nombre}`}
                  disabled={i === categorias.length - 1}
                  onClick={() => void guardarVarios('categorias', mover(categorias, c.id, 1))}
                >
                  <ChevronDown aria-hidden size={28} />
                </Boton>
                <Boton variante="fantasma" aria-label={`Editar ${c.nombre}`} onClick={() => setEditando(c)}>
                  <Pencil aria-hidden size={18} /> Editar
                </Boton>
                <Boton
                  variante="fantasma"
                  className="w-12 px-0 text-faltante"
                  aria-label={`Eliminar ${c.nombre}`}
                  onClick={() => setEliminando(c)}
                >
                  <Trash aria-hidden size={20} />
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Pantalla>
      {editando && (
        <FormularioCategoria
          inicial={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={async (c) => {
            await guardar('categorias', c);
            setEditando(null);
          }}
        />
      )}
      {eliminando &&
        (cuantos(eliminando.id) > 0 ? (
          <Confirmar
            titulo={`No se puede eliminar ${eliminando.nombre}`}
            textoAccion="Entendido"
            variante="oscuro"
            alConfirmar={() => setEliminando(null)}
            alCancelar={() => setEliminando(null)}
          >
            <p>Mueve o elimina sus productos primero.</p>
          </Confirmar>
        ) : (
          <Confirmar
            titulo={`¿Eliminar ${eliminando.nombre}?`}
            textoAccion="Eliminar"
            textoCancelar="Conservar"
            alConfirmar={() => {
              void borrar('categorias', eliminando.id);
              setEliminando(null);
            }}
            alCancelar={() => setEliminando(null)}
          >
            <p>La categoría no tiene productos.</p>
          </Confirmar>
        ))}
    </RequierePermiso>
  );
}
