import { ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router';
import { Boton } from '@/componentes/Boton';
import { Casilla } from '@/componentes/Casilla';
import { indicacionGrupo, resumenOpciones } from '@/dominio/modificadores';
import { moverEn } from '@/dominio/orden';
import type { GrupoModificadores } from '@/dominio/tipos';

/**
 * Todos los grupos de extras/modificadores con una casilla para asignarlos al producto. Los
 * asignados van primero, en el orden en que se muestran en la venta, y se pueden subir o bajar.
 */
export function OpcionesAdicionales({
  grupos,
  gruposIds,
  editaMenu,
  alCambiar,
}: {
  grupos: GrupoModificadores[];
  gruposIds: string[];
  editaMenu: boolean;
  alCambiar: (gruposIds: string[]) => void;
}) {
  const asignados = gruposIds.filter((id) => grupos.some((g) => g.id === id));
  const ordenados = [
    ...asignados.map((id) => grupos.find((g) => g.id === id)!),
    ...grupos.filter((g) => !asignados.includes(g.id)),
  ];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-producto font-semibold">Opciones adicionales</legend>
      {grupos.length === 0 ? (
        <p className="text-grafito-suave">
          Aún no hay extras ni modificadores.{' '}
          <Link to="/menu/modificadores" className="font-semibold underline">
            Créalos en Modificadores
          </Link>
          .
        </p>
      ) : (
        <p className="text-etiqueta text-grafito-suave">
          Marca los que se ofrecen con este producto; se muestran en la venta en este orden.
        </p>
      )}
      {ordenados.map((g) => {
        const i = asignados.indexOf(g.id);
        return (
          <div key={g.id} className="flex items-center gap-2 rounded-boton border border-linea px-3 py-1">
            <Casilla
              marcada={i >= 0}
              deshabilitada={!editaMenu}
              alCambiar={(marcada) =>
                alCambiar(marcada ? [...asignados, g.id] : asignados.filter((id) => id !== g.id))
              }
            >
              <span className="font-semibold">{g.nombre}</span>{' '}
              <span className="text-grafito-suave">{indicacionGrupo(g)}</span>
              <span className="block truncate text-etiqueta text-grafito-suave">{resumenOpciones(g)}</span>
            </Casilla>
            {editaMenu && i >= 0 && (
              <>
                <Boton
                  variante="fantasma"
                  className="w-12 px-0"
                  aria-label={`Subir ${g.nombre}`}
                  disabled={i === 0}
                  onClick={() => alCambiar(moverEn(asignados, i, -1))}
                >
                  <ChevronUp aria-hidden size={24} />
                </Boton>
                <Boton
                  variante="fantasma"
                  className="w-12 px-0"
                  aria-label={`Bajar ${g.nombre}`}
                  disabled={i === asignados.length - 1}
                  onClick={() => alCambiar(moverEn(asignados, i, 1))}
                >
                  <ChevronDown aria-hidden size={24} />
                </Boton>
              </>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
