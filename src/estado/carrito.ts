import { create } from 'zustand';
import { guardarMeta, leerMeta, type UltimaVenta } from '@/datos/bd';
import * as c from '@/dominio/carrito';
import type { Carrito, DescuentoCarrito, LineaCarrito } from '@/dominio/carrito';

// Venta en curso. Se guarda en Dexie en cada cambio y se recupera tras recargar o cerrar la app.

interface EstadoCarrito {
  cargado: boolean;
  carrito: Carrito;
  /** Resultado de la última venta, visible con el carrito vacío hasta agregar el siguiente producto. */
  ultimaVenta: UltimaVenta | null;
  /** Línea recién agregada (para resaltarla un momento). */
  ultimaLineaId: string | null;
  cargar: () => Promise<void>;
  agregar: (linea: LineaCarrito) => void;
  reemplazar: (lineaId: string, linea: LineaCarrito) => void;
  cambiarCantidad: (lineaId: string, delta: number) => void;
  eliminar: (lineaId: string) => void;
  ponerNota: (lineaId: string, nota: string | null) => void;
  ponerCliente: (cliente: string | null) => void;
  ponerDescuento: (descuento: DescuentoCarrito | null) => void;
  vaciar: () => void;
  /** Tras cobrar: carrito vacío y el resultado de la venta a la vista. */
  terminarVenta: (ultimaVenta: UltimaVenta) => void;
}

export const useCarrito = create<EstadoCarrito>((set, get) => {
  const cambiar = (carrito: Carrito, extra: Partial<EstadoCarrito> = {}) => {
    set({ carrito, ...extra });
    void guardarMeta('carrito', carrito);
  };
  return {
    cargado: false,
    carrito: c.carritoVacio(),
    ultimaVenta: null,
    ultimaLineaId: null,
    cargar: async () => {
      if (get().cargado) return;
      const [carrito, ultimaVenta] = await Promise.all([leerMeta('carrito'), leerMeta('ultimaVenta')]);
      set({
        cargado: true,
        carrito: carrito ? c.completarCarrito(carrito) : c.carritoVacio(),
        ultimaVenta: ultimaVenta ?? null,
      });
    },
    agregar: (linea) => {
      const antes = get().carrito;
      const despues = c.agregarLinea(antes, linea);
      // La línea nueva o la idéntica a la que se le sumó la cantidad (conserva su lugar).
      const tocada = despues.lineas.find(
        (l, i) => l.id === linea.id || l.cantidad !== antes.lineas[i]?.cantidad,
      );
      cambiar(despues, { ultimaLineaId: tocada?.id ?? null, ultimaVenta: null });
      void guardarMeta('ultimaVenta', null);
    },
    reemplazar: (lineaId, linea) => cambiar(c.reemplazarLinea(get().carrito, lineaId, linea)),
    cambiarCantidad: (lineaId, delta) => cambiar(c.cambiarCantidad(get().carrito, lineaId, delta)),
    eliminar: (lineaId) => cambiar(c.eliminarLinea(get().carrito, lineaId)),
    ponerNota: (lineaId, nota) => cambiar(c.ponerNota(get().carrito, lineaId, nota)),
    ponerCliente: (cliente) => cambiar(c.ponerCliente(get().carrito, cliente)),
    ponerDescuento: (descuento) => cambiar(c.ponerDescuento(get().carrito, descuento)),
    vaciar: () => cambiar(c.carritoVacio()),
    terminarVenta: (ultimaVenta) => {
      cambiar(c.carritoVacio(), { ultimaVenta, ultimaLineaId: null });
      void guardarMeta('ultimaVenta', ultimaVenta);
    },
  };
});
