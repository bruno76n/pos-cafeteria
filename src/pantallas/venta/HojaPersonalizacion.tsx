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
  modificadoresElegidos,
  precioUnitario,
  puedeAgregarOpcion,
  seleccionPorDefecto,
  validarSeleccion,
  type Seleccion,
} from '@/dominio/modificadores';
import type { Categoria, GrupoModificadores, Producto } from '@/dominio/tipos';

/** Opciones del producto (con las por defecto ya elegidas), nota, cantidad y "Agregar $85.00". */
export function HojaPersonalizacion({
  producto,
  categoria,
  grupos,
  linea,
  alTerminar,
  alCerrar,
}: {
  producto: Producto;
  categoria: Categoria | undefined;
  grupos: GrupoModificadores[];
  /** Línea a editar (reabre la hoja con lo que tenía). */
  linea?: LineaCarrito;
  alTerminar: (linea: LineaCarrito) => void;
  alCerrar: () => void;
}) {
  const delProducto = gruposDelProducto(producto, grupos);
  const [seleccion, setSeleccion] = useState<Seleccion>(
    () => linea?.seleccion ?? seleccionPorDefecto(delProducto),
  );
  const [nota, setNota] = useState(linea?.nota ?? '');
  const [cantidad, setCantidad] = useState(linea?.cantidad ?? 1);

  const errores = validarSeleccion(delProducto, seleccion);
  const unitario = precioUnitario(producto.precio, modificadoresElegidos(delProducto, seleccion));
  const textoAccion = linea ? 'Guardar' : 'Agregar';

  function terminar() {
    alTerminar(crearLinea({ producto, categoria, grupos, seleccion, cantidad, nota }));
  }

  return (
    <Hoja
      titulo={producto.nombre}
      encabezado={
        <span className="cifras text-producto text-grafito-suave">{formatearDinero(producto.precio)}</span>
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
            onClick={terminar}
          >
            {errores[0]?.mensaje ?? (
              <>
                {textoAccion} <span className="cifras">{formatearDinero(unitario * cantidad)}</span>
              </>
            )}
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
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
                      className={`flex min-h-14 items-center gap-2 rounded-boton border px-4 font-semibold active:scale-[0.98] disabled:opacity-40 ${
                        elegida
                          ? 'border-grafito bg-grafito text-papel'
                          : 'border-linea bg-papel text-grafito'
                      }`}
                    >
                      {o.nombre}
                      {o.precioExtra > 0 && (
                        <span
                          className={`cifras font-normal ${elegida ? 'text-papel/80' : 'text-grafito-suave'}`}
                        >
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
