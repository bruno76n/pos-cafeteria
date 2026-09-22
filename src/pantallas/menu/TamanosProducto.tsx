import { ChevronDown, ChevronUp, Copy, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { clasesEntrada } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Hoja } from '@/componentes/Hoja';
import { formatearDineroCorto } from '@/dominio/dinero';
import { moverEn } from '@/dominio/orden';
import type { Producto, Tamano } from '@/dominio/tipos';

const tamanoNuevo = (): Tamano => ({ id: crypto.randomUUID(), nombre: '', precio: 0 });

/**
 * Tamaños propios del producto: nombre libre y precio, en orden (el primero viene elegido en la
 * venta). Agregar, quitar, copiar y cambiar precios pide `editaPrecio`.
 */
export function TamanosProducto({
  tamanos,
  otrosProductos,
  editaMenu,
  editaPrecio,
  alCambiar,
}: {
  tamanos: Tamano[];
  /** Productos de los que se pueden copiar tamaños. */
  otrosProductos: Producto[];
  editaMenu: boolean;
  editaPrecio: boolean;
  alCambiar: (tamanos: Tamano[]) => void;
}) {
  const [copiando, setCopiando] = useState(false);
  const conTamanos = otrosProductos.filter((p) => p.tamanos.length > 0);
  const cambiar = (id: string, cambios: Partial<Tamano>) =>
    alCambiar(tamanos.map((t) => (t.id === id ? { ...t, ...cambios } : t)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-producto font-semibold">Tamaños</legend>
      {tamanos.length === 0 ? (
        <p className="text-grafito-suave">Sin tamaños: se vende al precio base.</p>
      ) : (
        <p className="text-etiqueta text-grafito-suave">El primero es el que viene elegido en la venta.</p>
      )}
      {tamanos.map((t, i) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`Nombre del tamaño ${i + 1}`}
            className={`${clasesEntrada} min-w-40 flex-1`}
            value={t.nombre}
            maxLength={20}
            placeholder="Chica, Grande, 12 oz…"
            disabled={!editaMenu}
            onChange={(e) => cambiar(t.id, { nombre: e.target.value })}
          />
          <CampoDinero
            etiqueta={`Precio del tamaño ${i + 1}`}
            className="w-36 [&>label]:sr-only"
            valor={t.precio}
            disabled={!editaPrecio}
            alCambiar={(precio) => cambiar(t.id, { precio: precio ?? 0 })}
          />
          {editaMenu && (
            <>
              <Boton
                variante="fantasma"
                className="w-12 px-0"
                aria-label={`Subir el tamaño ${i + 1}`}
                disabled={i === 0}
                onClick={() => alCambiar(moverEn(tamanos, i, -1))}
              >
                <ChevronUp aria-hidden size={24} />
              </Boton>
              <Boton
                variante="fantasma"
                className="w-12 px-0"
                aria-label={`Bajar el tamaño ${i + 1}`}
                disabled={i === tamanos.length - 1}
                onClick={() => alCambiar(moverEn(tamanos, i, 1))}
              >
                <ChevronDown aria-hidden size={24} />
              </Boton>
            </>
          )}
          {editaPrecio && (
            <Boton
              variante="fantasma"
              className="w-12 px-0"
              aria-label={`Quitar el tamaño ${i + 1}`}
              onClick={() => alCambiar(tamanos.filter((x) => x.id !== t.id))}
            >
              <X aria-hidden />
            </Boton>
          )}
        </div>
      ))}
      {editaPrecio && (
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => alCambiar([...tamanos, tamanoNuevo()])}>
            <Plus aria-hidden size={18} /> Agregar tamaño
          </Boton>
          {conTamanos.length > 0 && (
            <Boton variante="fantasma" onClick={() => setCopiando(true)}>
              <Copy aria-hidden size={18} /> Copiar tamaños de…
            </Boton>
          )}
        </div>
      )}
      {copiando && (
        <Hoja titulo="Copiar tamaños de…" centrada ancho="max-w-lg" alCerrar={() => setCopiando(false)}>
          <ul className="flex flex-col">
            {conTamanos.map((p) => (
              <li key={p.id} className="border-b border-linea last:border-b-0">
                <button
                  type="button"
                  className="flex min-h-14 w-full flex-col justify-center px-2 py-2 text-left active:bg-acero"
                  onClick={() => {
                    alCambiar(p.tamanos.map((t) => ({ ...t, id: crypto.randomUUID() })));
                    setCopiando(false);
                  }}
                >
                  <span className="font-semibold">{p.nombre}</span>
                  <span className="cifras text-etiqueta text-grafito-suave">
                    {p.tamanos.map((t) => `${t.nombre} ${formatearDineroCorto(t.precio)}`).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Hoja>
      )}
    </fieldset>
  );
}
