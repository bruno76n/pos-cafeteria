import { agregarLinea, calcularTotales, carritoVacio, crearLinea, type Carrito } from '@/dominio/carrito';
import { armarVenta } from '@/dominio/cobro';
import { ahoraISO, diaLocal } from '@/dominio/fechas';
import type { Categoria, ConfigGeneral, Producto, Venta } from '@/dominio/tipos';

/** Venta de muestra para la vista previa del ticket cuando la tablet aún no tiene ventas. */
export function ventaDeMuestra(config: ConfigGeneral, productos: Producto[], categorias: Categoria[]): Venta {
  let carrito: Carrito = { ...carritoVacio(), cliente: 'Luis' };
  for (const [i, producto] of productos.slice(0, 2).entries()) {
    const categoria = categorias.find((c) => c.id === producto.categoriaId);
    carrito = agregarLinea(carrito, crearLinea({ producto, categoria, grupos: [], cantidad: 2 - i }));
  }
  if (carrito.lineas.length === 0) {
    carrito = agregarLinea(
      carrito,
      crearLinea({
        producto: {
          id: 'muestra',
          nombre: 'Café americano',
          descripcion: '',
          categoriaId: 'muestra',
          precio: 4500,
          imagen: null,
          disponible: true,
          orden: 1,
          gruposIds: [],
          tamanos: [],
          actualizadoEn: '',
        },
        categoria: undefined,
        grupos: [],
      }),
    );
  }
  const { total } = calcularTotales(carrito.lineas, null, config.ventas);
  const recibido = Math.ceil(total / 10000) * 10000;
  const fecha = ahoraISO();
  return {
    ...armarVenta({
      id: 'muestra',
      fecha,
      dia: diaLocal(fecha),
      carrito,
      config: config.ventas,
      pagos: [{ metodo: 'efectivo', monto: total, recibido }],
      turno: { id: 'muestra' },
      dispositivo: { id: 'muestra', nombre: 'Caja 1' },
      cajero: { id: 'muestra', nombre: 'Ana' },
    }),
    folio: 'A-000123',
    folioNumero: 123,
    actualizadoEn: fecha,
  };
}
