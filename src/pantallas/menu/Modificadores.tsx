import { ChevronDown, ChevronUp, Pencil, Plus, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo, clasesEntrada } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Confirmar } from '@/componentes/Confirmar';
import { Hoja } from '@/componentes/Hoja';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { RequierePermiso } from '@/componentes/RequierePermiso';
import { Segmentos } from '@/componentes/Segmentos';
import { useGruposModificadores, useProductos } from '@/datos/consultas';
import { borrar, guardar, guardarVarios } from '@/datos/escrituras';
import { esquemaGrupoModificadores } from '@/dominio/esquemas';
import { indicacionGrupo, resumenOpciones } from '@/dominio/modificadores';
import { mover, siguienteOrden } from '@/dominio/orden';
import type { GrupoModificadores, OpcionModificador } from '@/dominio/tipos';

type Grupo = Omit<GrupoModificadores, 'actualizadoEn'>;

const opcionNueva = (): OpcionModificador => ({
  id: crypto.randomUUID(),
  nombre: '',
  precioExtra: 0,
  porDefecto: false,
  disponible: true,
});

/** Ajusta mínimo, máximo y opciones por defecto a lo que permite el tipo. */
function normalizar(g: Grupo): Grupo {
  const opciones = g.opciones.map((o) => ({ ...o, nombre: o.nombre.trim() })).filter((o) => o.nombre);
  if (g.tipo === 'unico') {
    let yaHayDefecto = false;
    return {
      ...g,
      min: g.obligatorio ? 1 : 0,
      max: 1,
      opciones: opciones.map((o) => {
        const porDefecto = o.porDefecto && !yaHayDefecto;
        if (porDefecto) yaHayDefecto = true;
        return { ...o, porDefecto };
      }),
    };
  }
  return { ...g, min: g.obligatorio ? Math.max(1, g.min) : g.min, opciones };
}

function FormularioGrupo({ inicial, alCerrar }: { inicial: Grupo; alCerrar: () => void }) {
  const [grupo, setGrupo] = useState<Grupo>(inicial);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (cambios: Partial<Grupo>) => setGrupo((g) => ({ ...g, ...cambios }));
  const cambiarOpcion = (id: string, cambios: Partial<OpcionModificador>) =>
    setGrupo((g) => ({
      ...g,
      opciones: g.opciones.map((o) =>
        o.id === id
          ? { ...o, ...cambios }
          : cambios.porDefecto && g.tipo === 'unico'
            ? { ...o, porDefecto: false }
            : o,
      ),
    }));

  async function guardarGrupo() {
    const listo = normalizar(grupo);
    if (listo.opciones.length === 0) return setError('Agrega al menos una opción.');
    if (listo.tipo === 'multiple' && listo.max > listo.opciones.length) {
      return setError(`El máximo no puede pasar de ${listo.opciones.length} (las opciones del grupo).`);
    }
    const r = esquemaGrupoModificadores.safeParse({ ...listo, actualizadoEn: new Date().toISOString() });
    if (!r.success) return setError(r.error.issues[0]?.message ?? 'Revisa los datos del grupo.');
    await guardar('gruposModificadores', listo);
    alCerrar();
  }

  return (
    <Hoja
      titulo={inicial.nombre ? `Editar ${inicial.nombre}` : 'Nuevo grupo'}
      alCerrar={alCerrar}
      pie={
        <div className="flex items-center justify-end gap-4">
          {error && (
            <p className="text-faltante" role="alert">
              {error}
            </p>
          )}
          <Boton variante="oscuro" tamano="grande" onClick={guardarGrupo}>
            Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre"
          placeholder="Leche, Extras…"
          value={grupo.nombre}
          maxLength={30}
          onChange={(e) => cambiar({ nombre: e.target.value })}
        />
        <div className="flex flex-wrap items-end gap-6">
          <Segmentos
            etiqueta="Tipo"
            valor={grupo.tipo}
            alCambiar={(tipo) => cambiar({ tipo, max: tipo === 'unico' ? 1 : Math.max(grupo.max, 2) })}
            opciones={[
              { valor: 'unico', texto: 'Una opción' },
              { valor: 'multiple', texto: 'Varias opciones' },
            ]}
          />
          <div className="w-48">
            <Interruptor
              etiqueta="Obligatorio"
              activo={grupo.obligatorio}
              alCambiar={(obligatorio) => cambiar({ obligatorio })}
            />
          </div>
          {grupo.tipo === 'multiple' && (
            <>
              <Campo
                etiqueta="Mínimo"
                inputMode="numeric"
                className="w-24"
                value={String(grupo.min)}
                onChange={(e) => cambiar({ min: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              />
              <Campo
                etiqueta="Máximo"
                inputMode="numeric"
                className="w-24"
                value={String(grupo.max)}
                onChange={(e) => cambiar({ max: Number(e.target.value.replace(/\D/g, '')) || 1 })}
              />
            </>
          )}
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-etiqueta text-grafito-suave">
              <th className="py-2 font-normal">Opción</th>
              <th className="py-2 font-normal">Precio extra</th>
              <th className="py-2 font-normal">Por defecto</th>
              <th className="py-2 font-normal">Disponible</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {grupo.opciones.map((o, i) => (
              <tr key={o.id} className="border-t border-linea">
                <td className="py-1 pr-2">
                  <input
                    aria-label={`Nombre de la opción ${i + 1}`}
                    className={clasesEntrada}
                    value={o.nombre}
                    maxLength={30}
                    onChange={(e) => cambiarOpcion(o.id, { nombre: e.target.value })}
                  />
                </td>
                <td className="w-36 py-1 pr-2">
                  <CampoDinero
                    etiqueta={`Precio extra de la opción ${i + 1}`}
                    className="[&>label]:sr-only"
                    valor={o.precioExtra}
                    alCambiar={(precioExtra) => cambiarOpcion(o.id, { precioExtra: precioExtra ?? 0 })}
                  />
                </td>
                <td className="py-1">
                  <Interruptor
                    soloInterruptor
                    etiqueta={`Opción ${i + 1} por defecto`}
                    activo={o.porDefecto}
                    alCambiar={(porDefecto) => cambiarOpcion(o.id, { porDefecto })}
                  />
                </td>
                <td className="py-1">
                  <Interruptor
                    soloInterruptor
                    etiqueta={`Opción ${i + 1} disponible`}
                    activo={o.disponible}
                    alCambiar={(disponible) => cambiarOpcion(o.id, { disponible })}
                  />
                </td>
                <td className="py-1 text-right">
                  <Boton
                    variante="fantasma"
                    className="w-12 px-0"
                    aria-label={`Quitar la opción ${i + 1}`}
                    onClick={() => cambiar({ opciones: grupo.opciones.filter((x) => x.id !== o.id) })}
                  >
                    <X aria-hidden />
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Boton
          className="self-start"
          onClick={() => cambiar({ opciones: [...grupo.opciones, opcionNueva()] })}
        >
          <Plus aria-hidden /> Agregar opción
        </Boton>
      </div>
    </Hoja>
  );
}

/** Grupos de modificadores: lista, orden, crear/editar con sus opciones y eliminar. */
export function Modificadores() {
  const grupos = useGruposModificadores();
  const productos = useProductos();
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [eliminando, setEliminando] = useState<GrupoModificadores | null>(null);
  if (!grupos || !productos) return null;
  const usanGrupo = (id: string) => productos.filter((p) => p.gruposIds.includes(id));

  async function eliminar(g: GrupoModificadores) {
    setEliminando(null);
    const afectados = usanGrupo(g.id).map(({ actualizadoEn: _, ...p }) => ({
      ...p,
      gruposIds: p.gruposIds.filter((id) => id !== g.id),
    }));
    if (afectados.length) await guardarVarios('productos', afectados);
    await borrar('gruposModificadores', g.id);
  }

  return (
    <RequierePermiso permiso="crearProductos">
      <Pantalla
        titulo="Modificadores"
        acciones={
          <Boton
            variante="oscuro"
            onClick={() =>
              setEditando({
                id: crypto.randomUUID(),
                nombre: '',
                tipo: 'unico',
                obligatorio: false,
                min: 0,
                max: 1,
                orden: siguienteOrden(grupos),
                opciones: [opcionNueva()],
              })
            }
          >
            <Plus aria-hidden /> Nuevo grupo
          </Boton>
        }
      >
        {grupos.length === 0 ? (
          <p className="p-8 text-center text-grafito-suave">Aún no hay grupos de modificadores.</p>
        ) : (
          <ul className="flex flex-col rounded-hoja border border-linea bg-papel">
            {grupos.map((g, i) => (
              <li
                key={g.id}
                className="flex min-h-16 flex-wrap items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-producto font-semibold">{g.nombre}</span>{' '}
                  <span className="text-grafito-suave">{indicacionGrupo(g)}</span>
                  <span className="block truncate text-etiqueta text-grafito-suave">
                    {resumenOpciones(g)}
                  </span>
                </span>
                <span className="text-etiqueta text-grafito-suave">
                  En {usanGrupo(g.id).length} {usanGrupo(g.id).length === 1 ? 'producto' : 'productos'}
                </span>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Subir ${g.nombre}`}
                  disabled={i === 0}
                  onClick={() => void guardarVarios('gruposModificadores', mover(grupos, g.id, -1))}
                >
                  <ChevronUp aria-hidden size={28} />
                </Boton>
                <Boton
                  className="w-12 px-0"
                  aria-label={`Bajar ${g.nombre}`}
                  disabled={i === grupos.length - 1}
                  onClick={() => void guardarVarios('gruposModificadores', mover(grupos, g.id, 1))}
                >
                  <ChevronDown aria-hidden size={28} />
                </Boton>
                <Boton variante="fantasma" aria-label={`Editar ${g.nombre}`} onClick={() => setEditando(g)}>
                  <Pencil aria-hidden size={18} /> Editar
                </Boton>
                <Boton
                  variante="fantasma"
                  className="w-12 px-0 text-faltante"
                  aria-label={`Eliminar ${g.nombre}`}
                  onClick={() => setEliminando(g)}
                >
                  <Trash aria-hidden size={20} />
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Pantalla>
      {editando && <FormularioGrupo inicial={editando} alCerrar={() => setEditando(null)} />}
      {eliminando && (
        <Confirmar
          titulo={`¿Eliminar ${eliminando.nombre}?`}
          textoAccion="Eliminar"
          textoCancelar="Conservar"
          alConfirmar={() => void eliminar(eliminando)}
          alCancelar={() => setEliminando(null)}
        >
          <p>
            {usanGrupo(eliminando.id).length > 0
              ? `Se quitará de ${usanGrupo(eliminando.id).length} productos. Las ventas pasadas no cambian.`
              : 'Ningún producto lo usa.'}
          </p>
        </Confirmar>
      )}
    </RequierePermiso>
  );
}
