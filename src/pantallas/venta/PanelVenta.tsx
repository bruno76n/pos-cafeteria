import { Minus, Pencil, Plus, StickyNote, Trash } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Boton } from '@/componentes/Boton';
import { clasesEntrada } from '@/componentes/Campo';
import { Confirmar } from '@/componentes/Confirmar';
import { Hoja } from '@/componentes/Hoja';
import { cantidadDeProductos, type LineaCarrito, type Totales } from '@/dominio/carrito';
import { formatearDinero } from '@/dominio/dinero';
import { resumenModificadores } from '@/dominio/modificadores';
import { useCarrito } from '@/estado/carrito';

function Fila({ etiqueta, valor, fuerte }: { etiqueta: ReactNode; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${fuerte ? 'font-semibold' : 'text-grafito-suave'}`}>
      <span>{etiqueta}</span>
      <span className="cifras">{valor}</span>
    </div>
  );
}

function Linea({
  linea,
  resaltada,
  alEditar,
  alNota,
}: {
  linea: LineaCarrito;
  resaltada: boolean;
  alEditar?: () => void;
  alNota: () => void;
}) {
  const { cambiarCantidad, eliminar } = useCarrito.getState();
  const resumen = resumenModificadores(linea.modificadores);
  return (
    <li className={`border-b border-linea px-4 py-3 ${resaltada ? 'animate-resaltar' : ''}`}>
      <div className="flex items-baseline gap-3">
        <span className="cifras w-6 shrink-0 text-right text-producto font-semibold">{linea.cantidad}</span>
        <span className="min-w-0 flex-1 text-producto font-semibold">{linea.nombre}</span>
        <span className="cifras font-semibold">{formatearDinero(linea.importe)}</span>
      </div>
      <div className="ml-9 flex flex-col text-etiqueta text-grafito-suave">
        {linea.cantidad > 1 && (
          <span className="cifras">
            {linea.cantidad} × {formatearDinero(linea.precioUnitario)}
          </span>
        )}
        {resumen && <span>{resumen}</span>}
        {linea.nota && <span className="text-grafito">Nota: {linea.nota}</span>}
      </div>
      <div className="mt-2 flex gap-1">
        <Boton className="w-12 px-0" aria-label={`Quitar uno de ${linea.nombre}`} onClick={() => cambiarCantidad(linea.id, -1)}>
          <Minus aria-hidden size={20} />
        </Boton>
        <Boton className="w-12 px-0" aria-label={`Agregar uno de ${linea.nombre}`} onClick={() => cambiarCantidad(linea.id, 1)}>
          <Plus aria-hidden size={20} />
        </Boton>
        {alEditar && (
          <Boton variante="fantasma" className="px-3" aria-label={`Editar ${linea.nombre}`} onClick={alEditar}>
            <Pencil aria-hidden size={18} /> Editar
          </Boton>
        )}
        <Boton variante="fantasma" className="px-3" aria-label={`Nota de ${linea.nombre}`} onClick={alNota}>
          <StickyNote aria-hidden size={18} /> Nota
        </Boton>
        <Boton
          variante="fantasma"
          className="ml-auto w-12 px-0 text-faltante"
          aria-label={`Eliminar ${linea.nombre}`}
          onClick={() => eliminar(linea.id)}
        >
          <Trash aria-hidden size={20} />
        </Boton>
      </div>
    </li>
  );
}

function DialogoNota({ linea, alCerrar }: { linea: LineaCarrito; alCerrar: () => void }) {
  const [nota, setNota] = useState(linea.nota ?? '');
  const guardar = () => {
    useCarrito.getState().ponerNota(linea.id, nota);
    alCerrar();
  };
  return (
    <Hoja
      titulo={`Nota para ${linea.nombre}`}
      centrada
      ancho="max-w-md"
      alCerrar={alCerrar}
      pie={
        <div className="flex justify-end">
          <Boton variante="oscuro" tamano="grande" onClick={guardar}>
            Guardar nota
          </Boton>
        </div>
      }
    >
      <input
        aria-label="Nota"
        className={clasesEntrada}
        value={nota}
        maxLength={120}
        onChange={(e) => setNota(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
      />
    </Hoja>
  );
}

/** Carrito: líneas, "Para:", totales, acciones y la barra de Cobrar. */
export function PanelVenta({
  totales,
  etiquetaDescuento,
  mostrarIVA,
  resultado,
  acciones,
  puedeEditar,
  alEditar,
  alCobrar,
}: {
  totales: Totales;
  etiquetaDescuento: string;
  mostrarIVA: boolean;
  /** Resultado de la última venta (se muestra con el carrito vacío). */
  resultado: ReactNode;
  /** Botones extra junto a Vaciar (Descuento). */
  acciones: ReactNode;
  puedeEditar: (linea: LineaCarrito) => boolean;
  alEditar: (linea: LineaCarrito) => void;
  alCobrar: () => void;
}) {
  const carrito = useCarrito((s) => s.carrito);
  const ultimaLineaId = useCarrito((s) => s.ultimaLineaId);
  const { ponerCliente, vaciar } = useCarrito.getState();
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);
  const [notaDe, setNotaDe] = useState<LineaCarrito | null>(null);
  const vacio = carrito.lineas.length === 0;
  const productos = cantidadDeProductos(carrito);

  return (
    <aside aria-label="Venta actual" className="flex min-h-0 flex-1 flex-col bg-papel">
      <div className="flex flex-col gap-2 border-b border-linea p-4">
        <h2 className="text-seccion font-semibold">Venta actual</h2>
        <label className="flex items-center gap-2">
          <span className="text-grafito-suave">Para:</span>
          <input
            className={clasesEntrada}
            placeholder="Nombre del cliente"
            value={carrito.cliente ?? ''}
            maxLength={40}
            onChange={(e) => ponerCliente(e.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {vacio ? (
          (resultado ?? <p className="p-8 text-center text-grafito-suave">Toca un producto para empezar.</p>)
        ) : (
          <ul>
            {carrito.lineas.map((l) => (
              <Linea
                key={l.id}
                linea={l}
                resaltada={l.id === ultimaLineaId}
                alEditar={puedeEditar(l) ? () => alEditar(l) : undefined}
                alNota={() => setNotaDe(l)}
              />
            ))}
          </ul>
        )}
      </div>

      {!vacio && (
        <div className="flex flex-col gap-1 border-t border-linea px-4 pt-3">
          <Fila etiqueta="Subtotal" valor={formatearDinero(totales.subtotal)} />
          {totales.descuento > 0 && (
            <Fila etiqueta={etiquetaDescuento} valor={`−${formatearDinero(totales.descuento)}`} />
          )}
          {mostrarIVA && (
            <Fila
              etiqueta={totales.iva.incluido ? 'IVA incluido' : `IVA ${Math.round(totales.iva.tasa * 100)} %`}
              valor={formatearDinero(totales.iva.monto)}
            />
          )}
          <div className="mt-2 flex gap-2">
            {acciones}
            <Boton className="flex-1" onClick={() => setConfirmandoVaciar(true)}>
              Vaciar
            </Boton>
          </div>
        </div>
      )}

      <div className="p-4">
        <button
          type="button"
          disabled={vacio}
          onClick={alCobrar}
          className="flex min-h-18 w-full items-center justify-between rounded-boton bg-cafeto px-5 text-papel transition-transform duration-100 active:scale-[0.98] active:bg-cafeto-oscuro disabled:opacity-40"
        >
          <span className="text-seccion font-semibold">Cobrar</span>
          <span className="cifras text-total leading-none font-extrabold">
            {formatearDinero(totales.total)}
          </span>
        </button>
      </div>

      {confirmandoVaciar && (
        <Confirmar
          titulo="¿Vaciar la venta?"
          textoAccion="Vaciar"
          textoCancelar="Conservar"
          alConfirmar={() => {
            vaciar();
            setConfirmandoVaciar(false);
          }}
          alCancelar={() => setConfirmandoVaciar(false)}
        >
          <p>Se {productos === 1 ? 'quitará 1 producto' : `quitarán ${productos} productos`}.</p>
        </Confirmar>
      )}
      {notaDe && <DialogoNota linea={notaDe} alCerrar={() => setNotaDe(null)} />}
    </aside>
  );
}
