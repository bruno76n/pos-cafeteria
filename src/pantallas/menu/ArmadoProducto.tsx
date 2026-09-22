import { useState } from 'react';
import { Link } from 'react-router';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Casilla } from '@/componentes/Casilla';
import { Interruptor } from '@/componentes/Interruptor';
import { Segmentos } from '@/componentes/Segmentos';
import type { Armado, Ingrediente, Producto } from '@/dominio/tipos';

const ARMADO_NUEVO: Armado = { incluidos: 0, precioExtra: 0, min: 1, max: null, permitidos: null };
const TODOS = '*';
const SIN_GRUPO = '-';

/** Número entero de un campo de texto ("" → null). */
const leerEntero = (texto: string) => {
  const limpio = texto.replace(/\D/g, '');
  return limpio === '' ? null : Number(limpio);
};

/**
 * "Se arma con ingredientes": incluidos (por tamaño o uno solo), precio del ingrediente extra
 * (pide `editaPrecio`), mínimo, máximo (vacío = sin límite) y los ingredientes permitidos.
 */
export function ArmadoProducto({
  producto,
  ingredientes,
  editaMenu,
  editaPrecio,
  alCambiar,
}: {
  producto: Pick<Producto, 'tamanos' | 'armado'>;
  ingredientes: Ingrediente[];
  editaMenu: boolean;
  editaPrecio: boolean;
  alCambiar: (cambios: Partial<Pick<Producto, 'tamanos' | 'armado'>>) => void;
}) {
  const [filtro, setFiltro] = useState(TODOS);
  const { armado, tamanos } = producto;
  const grupos = [...new Set(ingredientes.map((i) => i.grupo ?? SIN_GRUPO))];
  const visibles = ingredientes.filter((i) => filtro === TODOS || (i.grupo ?? SIN_GRUPO) === filtro);

  const interruptor = (
    <div className="max-w-sm">
      <Interruptor
        etiqueta="Se arma con ingredientes"
        descripcion="Al vender se eligen ingredientes del catálogo."
        activo={armado !== null}
        deshabilitado={!editaMenu}
        alCambiar={(activo) => alCambiar({ armado: activo ? ARMADO_NUEVO : null })}
      />
    </div>
  );
  if (!armado) return interruptor;

  const cambiar = (cambios: Partial<Armado>) => alCambiar({ armado: { ...armado, ...cambios } });
  const permitidos = (armado.permitidos ?? []).filter((id) => ingredientes.some((i) => i.id === id));
  const alternar = (id: string, marcada: boolean) =>
    cambiar({ permitidos: marcada ? [...permitidos, id] : permitidos.filter((x) => x !== id) });
  const marcarVisibles = (marcar: boolean) => {
    const ids = new Set(visibles.map((i) => i.id));
    const resto = permitidos.filter((id) => !ids.has(id));
    cambiar({ permitidos: marcar ? [...resto, ...ids] : resto });
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Ingredientes</legend>
      {interruptor}
      <div className="flex flex-wrap items-end gap-3">
        {tamanos.length > 0 ? (
          tamanos.map((t) => (
            <Campo
              key={t.id}
              etiqueta={`Incluidos en ${t.nombre || 'el tamaño'}`}
              inputMode="numeric"
              className="w-40"
              value={String(t.incluidos)}
              disabled={!editaMenu}
              onChange={(e) =>
                alCambiar({
                  tamanos: tamanos.map((x) =>
                    x.id === t.id ? { ...x, incluidos: leerEntero(e.target.value) ?? 0 } : x,
                  ),
                })
              }
            />
          ))
        ) : (
          <Campo
            etiqueta="Ingredientes incluidos"
            inputMode="numeric"
            className="w-44"
            value={String(armado.incluidos)}
            disabled={!editaMenu}
            onChange={(e) => cambiar({ incluidos: leerEntero(e.target.value) ?? 0 })}
          />
        )}
        <CampoDinero
          etiqueta="Precio por ingrediente extra"
          className="w-52"
          valor={armado.precioExtra}
          disabled={!editaPrecio}
          alCambiar={(precioExtra) => cambiar({ precioExtra: precioExtra ?? 0 })}
        />
        <Campo
          etiqueta="Mínimo"
          inputMode="numeric"
          className="w-28"
          value={String(armado.min)}
          disabled={!editaMenu}
          onChange={(e) => cambiar({ min: leerEntero(e.target.value) ?? 0 })}
        />
        <Campo
          etiqueta="Máximo"
          inputMode="numeric"
          className="w-28"
          placeholder="Sin límite"
          value={armado.max === null ? '' : String(armado.max)}
          disabled={!editaMenu}
          onChange={(e) => cambiar({ max: leerEntero(e.target.value) || null })}
        />
      </div>
      {ingredientes.length === 0 ? (
        <p className="text-grafito-suave">
          Aún no hay ingredientes.{' '}
          <Link to="/menu/ingredientes" className="font-semibold underline">
            Agrégalos en Ingredientes
          </Link>
          .
        </p>
      ) : (
        <>
          <Segmentos
            etiqueta="Ingredientes permitidos"
            valor={armado.permitidos === null ? 'todos' : 'eleccion'}
            alCambiar={(v) => editaMenu && cambiar({ permitidos: v === 'todos' ? null : [] })}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              { valor: 'eleccion', texto: 'Elegir' },
            ]}
          />
          {armado.permitidos !== null && (
            <div className="flex flex-col gap-3 rounded-boton border border-linea p-3">
              {grupos.length > 1 && (
                <Segmentos
                  etiqueta="Grupo"
                  valor={filtro}
                  alCambiar={setFiltro}
                  opciones={[
                    { valor: TODOS, texto: 'Todos los grupos' },
                    ...grupos.map((g) => ({ valor: g, texto: g === SIN_GRUPO ? 'Sin grupo' : g })),
                  ]}
                />
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-4">
                {visibles.map((i) => (
                  <Casilla
                    key={i.id}
                    marcada={permitidos.includes(i.id)}
                    deshabilitada={!editaMenu}
                    alCambiar={(marcada) => alternar(i.id, marcada)}
                  >
                    {i.nombre}
                  </Casilla>
                ))}
              </div>
              {editaMenu && (
                <div className="flex flex-wrap items-center gap-2">
                  <Boton onClick={() => marcarVisibles(true)}>Marcar todos</Boton>
                  <Boton variante="fantasma" onClick={() => marcarVisibles(false)}>
                    Quitar todos
                  </Boton>
                  <span className="text-etiqueta text-grafito-suave">
                    {permitidos.length} {permitidos.length === 1 ? 'permitido' : 'permitidos'}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
