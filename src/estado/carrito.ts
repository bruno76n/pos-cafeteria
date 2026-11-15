import { create } from 'zustand';
import { guardarMeta, leerMeta, type UltimaVenta } from '@/datos/bd';
import * as c from '@/dominio/carrito';
import type { Carrito, DescuentoCarrito, LineaCarrito } from '@/dominio/carrito';

// Pedido en curso (borrador). Cada cuenta abierta tiene el suyo; el que no pertenece a ninguna
// cuenta (venta de mostrador) usa la clave vacía. Se guarda en Dexie en cada cambio y se recupera
// tras recargar o cerrar la app.

/** Clave del borrador que no pertenece a ninguna cuenta. */
export const SIN_CUENTA = '';

interface EstadoCarrito {
  cargado: boolean;
  /** Cuenta con la que se trabaja (null = venta de mostrador sin cuenta). */
  cuentaActivaId: string | null;
  borradores: Record<string, Carrito>;
  /** Borrador de la cuenta activa. */
  carrito: Carrito;
  /** Resultado de la última venta, visible con el carrito vacío hasta agregar el siguiente producto. */
  ultimaVenta: UltimaVenta | null;
  /** Línea recién agregada (para resaltarla un momento). */
  ultimaLineaId: string | null;
  cargar: () => Promise<void>;
  /** Cambia de cuenta (o a la venta sin cuenta); cada una conserva su borrador. */
  activarCuenta: (cuentaId: string | null) => void;
  /** La cuenta ya no está abierta (se cobró en otro dispositivo): descarta su borrador. */
  soltarCuenta: (cuentaId: string) => void;
  agregar: (linea: LineaCarrito) => void;
  reemplazar: (lineaId: string, linea: LineaCarrito) => void;
  cambiarCantidad: (lineaId: string, delta: number) => void;
  eliminar: (lineaId: string) => void;
  ponerNota: (lineaId: string, nota: string | null) => void;
  ponerCliente: (cliente: string | null) => void;
  ponerDescuento: (descuento: DescuentoCarrito | null) => void;
  vaciar: () => void;
  /** Tras enviar el borrador a cocina: queda vacío (menos el descuento) y la cuenta pasa a ser la activa. */
  pedidoEnviado: (cuentaId: string) => void;
  /** Tras cobrar: borrador de la cuenta fuera, sin cuenta activa y el resultado de la venta a la vista. */
  terminarVenta: (ultimaVenta: UltimaVenta) => void;
}

const clave = (cuentaId: string | null) => cuentaId ?? SIN_CUENTA;

/** Un borrador sin nada no se guarda. */
const esVacio = (carrito: Carrito) => carrito.lineas.length === 0 && !carrito.cliente && !carrito.descuento;

function sinBorrador(borradores: Record<string, Carrito>, cuentaId: string) {
  const { [cuentaId]: _, ...resto } = borradores;
  return resto;
}

export const useCarrito = create<EstadoCarrito>((set, get) => {
  /** Guarda el borrador de la cuenta activa. */
  const cambiar = (carrito: Carrito, extra: Partial<EstadoCarrito> = {}) => {
    const k = clave(get().cuentaActivaId);
    const borradores = esVacio(carrito)
      ? sinBorrador(get().borradores, k)
      : { ...get().borradores, [k]: carrito };
    set({ carrito, borradores, ...extra });
    void guardarMeta('borradores', borradores);
  };
  const activar = (cuentaId: string | null, borradores: Record<string, Carrito>) => {
    set({ cuentaActivaId: cuentaId, borradores, carrito: borradores[clave(cuentaId)] ?? c.carritoVacio() });
    void guardarMeta('cuentaActivaId', cuentaId);
    void guardarMeta('borradores', borradores);
  };
  return {
    cargado: false,
    cuentaActivaId: null,
    borradores: {},
    carrito: c.carritoVacio(),
    ultimaVenta: null,
    ultimaLineaId: null,
    cargar: async () => {
      if (get().cargado) return;
      const [guardados, cuentaActivaId, ultimaVenta] = await Promise.all([
        leerMeta('borradores'),
        leerMeta('cuentaActivaId'),
        leerMeta('ultimaVenta'),
      ]);
      const borradores = Object.fromEntries(
        Object.entries(guardados ?? {}).map(([k, carrito]) => [k, c.completarCarrito(carrito)]),
      );
      set({
        cargado: true,
        cuentaActivaId: cuentaActivaId ?? null,
        borradores,
        carrito: borradores[clave(cuentaActivaId ?? null)] ?? c.carritoVacio(),
        ultimaVenta: ultimaVenta ?? null,
      });
    },
    activarCuenta: (cuentaId) => activar(cuentaId, get().borradores),
    soltarCuenta: (cuentaId) => {
      const borradores = sinBorrador(get().borradores, cuentaId);
      if (get().cuentaActivaId === cuentaId) activar(null, borradores);
      else {
        set({ borradores });
        void guardarMeta('borradores', borradores);
      }
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
    pedidoEnviado: (cuentaId) => {
      // El descuento es de la cuenta, no del pedido: se queda hasta cobrar.
      const { descuento } = get().carrito;
      const borradores = sinBorrador(get().borradores, clave(get().cuentaActivaId));
      activar(
        cuentaId,
        descuento ? { ...borradores, [cuentaId]: { ...c.carritoVacio(), descuento } } : borradores,
      );
      set({ ultimaLineaId: null });
    },
    terminarVenta: (ultimaVenta) => {
      activar(null, sinBorrador(get().borradores, clave(get().cuentaActivaId)));
      set({ ultimaVenta, ultimaLineaId: null });
      void guardarMeta('ultimaVenta', ultimaVenta);
    },
  };
});
