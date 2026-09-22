import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Hoja } from '@/componentes/Hoja';
import { clasesEntrada } from '@/componentes/Campo';
import { crearLinea, type LineaCarrito } from '@/dominio/carrito';
import { formatearDinero, formatearDineroCorto } from '@/dominio/dinero';
import {
  alternarOpcion,
  gruposDelProducto,
  indicacionGrupo,
  puedeAgregarOpcion,
  seleccionPorDefecto,
  type Seleccion,
} from '@/dominio/modificadores';
import {
  alternarIngrediente,
  contadorIngredientes,
  incluidosDe,
  indicacionIngredientes,
  ingredientesDelProducto,
  precioBaseDe,
  puedeAgregarIngrediente,
  tamanoInicial,
  validarEleccion,
} from '@/dominio/personalizacion';
import type { Categoria, GrupoModificadores, Ingrediente, Producto } from '@/dominio/tipos';

const clasesOpcion = (elegida: boolean) =>
  `flex min-h-14 items-center gap-2 rounded-boton border px-4 font-semibold active:scale-[0.98] disabled:opacity-40 ${
    elegida ? 'border-grafito bg-grafito text-papel' : 'border-linea bg-papel text-grafito'
  }`;

const clasesPrecioOpcion = (elegida: boolean) =>
  `cifras font-normal ${elegida ? 'text-papel/80' : 'text-grafito-suave'}`;

/** Ingredientes agrupados por su grupo, en el orden del catálogo. */
function porGrupo(ingredientes: Ingrediente[]): [string | null, Ingrediente[]][] {
  const grupos = new Map<string | null, Ingrediente[]>();
  for (const i of ingredientes) grupos.set(i.grupo, [...(grupos.get(i.grupo) ?? []), i]);
  return [...grupos];
}

/**
 * Tamaño → ingredientes → extras (modificadores, con los por defecto ya elegidos) → nota →
 * cantidad, y "Agregar $85.00" o lo que falta.
 */
export function HojaPersonalizacion({
  producto,
  categoria,
  grupos,
  ingredientes,
  linea,
  alTerminar,
  alCerrar,
}: {
  producto: Producto;
  categoria: Categoria | undefined;
  grupos: GrupoModificadores[];
  ingredientes: Ingrediente[];
  /** Línea a editar (reabre la hoja con lo que tenía). */
  linea?: LineaCarrito;
  alTerminar: (linea: LineaCarrito) => void;
  alCerrar: () => void;
}) {
  const delProducto = gruposDelProducto(producto, grupos);
  const posibles = ingredientesDelProducto(producto, ingredientes);
  const [tamanoId, setTamanoId] = useState(() => linea?.tamanoId ?? tamanoInicial(producto));
  const [ingredientesIds, setIngredientesIds] = useState(() => linea?.ingredientesIds ?? []);
  const [seleccion, setSeleccion] = useState<Seleccion>(
    () => linea?.seleccion ?? seleccionPorDefecto(delProducto),
  );
  const [nota, setNota] = useState(linea?.nota ?? '');
  const [cantidad, setCantidad] = useState(linea?.cantidad ?? 1);

  const eleccion = { tamanoId, ingredientesIds, seleccion };
  const errores = validarEleccion(producto, { grupos, ingredientes }, eleccion);
  const nueva = crearLinea({ producto, categoria, grupos, ingredientes, eleccion, cantidad, nota });
  const indicacion = indicacionIngredientes(producto, tamanoId);
  const lleno = !puedeAgregarIngrediente(producto, ingredientesIds);
  const textoAccion = linea ? 'Guardar' : 'Agregar';

  return (
    <Hoja
      titulo={producto.nombre}
      encabezado={
        <span className="cifras text-producto text-grafito-suave">
          {formatearDinero(precioBaseDe(producto, tamanoId))}
        </span>
      }
      alCerrar={alCerrar}
      pie={
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2" role="group" aria-label="Cantidad">
            <span className="text-grafito-suave">Cantidad</span>
            <Boton
              aria-label="Menos"
              onClick={() => setCantidad((n) => Math.max(1, n - 1))}
              disabled={cantidad <= 1}
            >
              <Minus aria-hidden />
            </Boton>
            <span className="cifras w-10 text-center text-seccion font-semibold" aria-live="polite">
              {cantidad}
            </span>
            <Boton aria-label="Más" onClick={() => setCantidad((n) => n + 1)}>
              <Plus aria-hidden />
            </Boton>
          </div>
          <Boton
            variante="dinero"
            tamano="enorme"
            className="ml-auto min-w-64"
            disabled={errores.length > 0}
            onClick={() => alTerminar(nueva)}
          >
            {errores[0] ?? (
              <>
                {textoAccion} <span className="cifras">{formatearDinero(nueva.importe)}</span>
              </>
            )}
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {producto.tamanos.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-producto font-semibold">Tamaño</legend>
            <div className="flex flex-wrap gap-2">
              {producto.tamanos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={t.id === tamanoId}
                  onClick={() => setTamanoId(t.id)}
                  className={clasesOpcion(t.id === tamanoId)}
                >
                  {t.nombre}
                  <span className={clasesPrecioOpcion(t.id === tamanoId)}>
                    {formatearDineroCorto(t.precio)}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {producto.armado && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-producto font-semibold">Ingredientes</legend>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {indicacion && <p className="text-grafito-suave">{indicacion}</p>}
              <p className="cifras font-semibold" aria-live="polite">
                {contadorIngredientes(ingredientesIds.length, incluidosDe(producto, tamanoId))}
              </p>
            </div>
            {posibles.length === 0 && <p className="text-grafito-suave">No hay ingredientes para elegir.</p>}
            {porGrupo(posibles).map(([grupo, lista]) => (
              <div key={grupo ?? ''} className="flex flex-col gap-2">
                {grupo && <p className="text-etiqueta text-grafito-suave">{grupo}</p>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {lista.map((i) => {
                    const elegido = ingredientesIds.includes(i.id);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        aria-pressed={elegido}
                        disabled={!i.disponible || (lleno && !elegido)}
                        onClick={() =>
                          setIngredientesIds((ids) => alternarIngrediente(producto, ingredientes, ids, i.id))
                        }
                        className={`${clasesOpcion(elegido)} min-h-16 justify-center text-center`}
                      >
                        {i.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>
        )}
        {delProducto.map((g) => {
          const elegidas = seleccion[g.id] ?? [];
          const lleno = !puedeAgregarOpcion(g, seleccion);
          return (
            <fieldset key={g.id} className="flex flex-col gap-2">
              <legend className="mb-2 text-producto font-semibold">
                {g.nombre} <span className="font-normal text-grafito-suave">{indicacionGrupo(g)}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {g.opciones.map((o) => {
                  const elegida = elegidas.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={elegida}
                      disabled={!o.disponible || (lleno && !elegida)}
                      onClick={() => setSeleccion((s) => alternarOpcion(g, s, o.id))}
                      className={clasesOpcion(elegida)}
                    >
                      {o.nombre}
                      {o.precioExtra > 0 && (
                        <span className={clasesPrecioOpcion(elegida)}>
                          +{formatearDineroCorto(o.precioExtra)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        <label className="flex flex-col gap-1">
          <span className="text-etiqueta text-grafito-suave">Nota</span>
          <input
            className={clasesEntrada}
            value={nota}
            maxLength={120}
            placeholder="Sin espuma, extra caliente…"
            onChange={(e) => setNota(e.target.value)}
          />
        </label>
      </div>
    </Hoja>
  );
}
