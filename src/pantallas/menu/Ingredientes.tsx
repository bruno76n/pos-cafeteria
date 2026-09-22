import { ChevronDown, ChevronUp, Pencil, Plus, Trash } from 'lucide-react';
import { useRef, useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Confirmar } from '@/componentes/Confirmar';
import { Hoja } from '@/componentes/Hoja';
import { Insignia } from '@/componentes/Insignia';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { RequierePermiso } from '@/componentes/RequierePermiso';
import { useIngredientes, useProductos } from '@/datos/consultas';
import { borrar, guardar, guardarVarios } from '@/datos/escrituras';
import { mover, siguienteOrden } from '@/dominio/orden';
import type { Ingrediente } from '@/dominio/tipos';

type SinFecha = Omit<Ingrediente, 'actualizadoEn'>;

const ID_GRUPOS = 'grupos-de-ingredientes';
const limpiarGrupo = (grupo: string) => grupo.trim() || null;

function FormularioIngrediente({ inicial, alCerrar }: { inicial: SinFecha; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [grupo, setGrupo] = useState(inicial.grupo ?? '');
  const [error, setError] = useState<string | null>(null);
  return (
    <Hoja
      titulo={`Editar ${inicial.nombre}`}
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
              await guardar('ingredientes', {
                ...inicial,
                nombre: nombre.trim(),
                grupo: limpiarGrupo(grupo),
              });
              alCerrar();
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
          error={error}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Campo
          etiqueta="Grupo (opcional)"
          list={ID_GRUPOS}
          value={grupo}
          maxLength={20}
          placeholder="Dulces, Salados…"
          onChange={(e) => setGrupo(e.target.value)}
        />
      </div>
    </Hoja>
  );
}

/** Catálogo de ingredientes: alta rápida, editar, ordenar, disponible y eliminar. */
export function Ingredientes() {
  const ingredientes = useIngredientes();
  const productos = useProductos();
  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState('');
  const [editando, setEditando] = useState<Ingrediente | null>(null);
  const [eliminando, setEliminando] = useState<Ingrediente | null>(null);
  const campoNombre = useRef<HTMLInputElement>(null);
  if (!ingredientes || !productos) return null;
  const usanIngrediente = (id: string) => productos.filter((p) => p.armado?.permitidos?.includes(id));
  const grupos = [...new Set(ingredientes.flatMap((i) => (i.grupo ? [i.grupo] : [])))];

  async function agregar() {
    if (!nombre.trim()) return;
    await guardar('ingredientes', {
      id: crypto.randomUUID(),
      nombre: nombre.trim(),
      grupo: limpiarGrupo(grupo),
      orden: siguienteOrden(ingredientes!),
      disponible: true,
    });
    setNombre('');
    campoNombre.current?.focus();
  }

  /** Lo quita también de los productos que lo tenían permitido. */
  async function eliminar(ing: Ingrediente) {
    setEliminando(null);
    const afectados = usanIngrediente(ing.id).map(({ actualizadoEn: _, ...p }) => ({
      ...p,
      armado: p.armado && {
        ...p.armado,
        permitidos: p.armado.permitidos?.filter((id) => id !== ing.id) ?? null,
      },
    }));
    if (afectados.length) await guardarVarios('productos', afectados);
    await borrar('ingredientes', ing.id);
  }

  return (
    <RequierePermiso permiso="crearProductos">
      <Pantalla titulo="Ingredientes">
        <datalist id={ID_GRUPOS}>
          {grupos.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-hoja border border-linea bg-papel p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void agregar();
          }}
        >
          <Campo
            ref={campoNombre}
            etiqueta="Nuevo ingrediente"
            className="min-w-48 flex-1"
            value={nombre}
            maxLength={30}
            placeholder="Nutella, Jamón…"
            onChange={(e) => setNombre(e.target.value)}
          />
          <Campo
            etiqueta="Grupo (opcional)"
            className="w-56"
            list={ID_GRUPOS}
            value={grupo}
            maxLength={20}
            placeholder="Dulces, Salados…"
            onChange={(e) => setGrupo(e.target.value)}
          />
          <Boton type="submit" variante="oscuro" disabled={!nombre.trim()}>
            <Plus aria-hidden /> Agregar
          </Boton>
        </form>
        {ingredientes.length === 0 ? (
          <p className="p-8 text-center text-grafito-suave">Aún no hay ingredientes.</p>
        ) : (
          <ul className="flex flex-col rounded-hoja border border-linea bg-papel">
            {ingredientes.map((ing, i) => (
              <li
                key={ing.id}
                className="flex min-h-16 flex-wrap items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className={`text-producto font-semibold ${ing.disponible ? '' : 'opacity-50'}`}>
                    {ing.nombre}
                  </span>
                  {ing.grupo && (
                    <span className="ml-2">
                      <Insignia>{ing.grupo}</Insignia>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-etiqueta text-grafito-suave">
                  Disponible
                  <Interruptor
                    soloInterruptor
                    etiqueta={`${ing.nombre} disponible`}
                    activo={ing.disponible}
                    alCambiar={(disponible) => void guardar('ingredientes', { ...ing, disponible })}
                  />
                </span>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Subir ${ing.nombre}`}
                  disabled={i === 0}
                  onClick={() => void guardarVarios('ingredientes', mover(ingredientes, ing.id, -1))}
                >
                  <ChevronUp aria-hidden size={28} />
                </Boton>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Bajar ${ing.nombre}`}
                  disabled={i === ingredientes.length - 1}
                  onClick={() => void guardarVarios('ingredientes', mover(ingredientes, ing.id, 1))}
                >
                  <ChevronDown aria-hidden size={28} />
                </Boton>
                <Boton
                  variante="fantasma"
                  aria-label={`Editar ${ing.nombre}`}
                  onClick={() => setEditando(ing)}
                >
                  <Pencil aria-hidden size={18} /> Editar
                </Boton>
                <Boton
                  variante="fantasma"
                  className="w-12 px-0 text-faltante"
                  aria-label={`Eliminar ${ing.nombre}`}
                  onClick={() => setEliminando(ing)}
                >
                  <Trash aria-hidden size={20} />
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Pantalla>
      {editando && <FormularioIngrediente inicial={editando} alCerrar={() => setEditando(null)} />}
      {eliminando && (
        <Confirmar
          titulo={`¿Eliminar ${eliminando.nombre}?`}
          textoAccion="Eliminar"
          textoCancelar="Conservar"
          alConfirmar={() => void eliminar(eliminando)}
          alCancelar={() => setEliminando(null)}
        >
          <p>
            {usanIngrediente(eliminando.id).length > 0
              ? `Se quitará de ${usanIngrediente(eliminando.id).length === 1 ? '1 producto' : `${usanIngrediente(eliminando.id).length} productos`}. `
              : ''}
            Las ventas pasadas no cambian: guardan su propia copia.
          </p>
        </Confirmar>
      )}
    </RequierePermiso>
  );
}
