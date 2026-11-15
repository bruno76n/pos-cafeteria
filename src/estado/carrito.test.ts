import { beforeEach, describe, expect, test } from 'vitest';
import { bd, leerMeta } from '@/datos/bd';
import { carritoVacio, crearLinea } from '@/dominio/carrito';
import { categoriaPrueba, productoPrueba } from '@/dominio/datosPrueba';
import { SIN_CUENTA, useCarrito } from './carrito';

const brownie = () =>
  crearLinea({ producto: productoPrueba('brownie'), categoria: categoriaPrueba('postres'), grupos: [] });

/** Como si se hubiera cerrado y vuelto a abrir la app. */
async function recargar() {
  useCarrito.setState({
    cargado: false,
    cuentaActivaId: null,
    borradores: {},
    carrito: carritoVacio(),
    ultimaVenta: null,
    ultimaLineaId: null,
  });
  await useCarrito.getState().cargar();
}

beforeEach(async () => {
  await Promise.all(bd.tables.map((t) => t.clear()));
  await recargar();
});

describe('borrador por cuenta', () => {
  test('cada cuenta conserva su propio pedido en curso', async () => {
    const { agregar, activarCuenta } = useCarrito.getState();
    agregar(brownie());
    activarCuenta('c1');
    expect(useCarrito.getState().carrito.lineas).toHaveLength(0);
    agregar(brownie());
    agregar(brownie());
    activarCuenta('c2');
    agregar(brownie());
    expect(useCarrito.getState().borradores['c1']?.lineas[0]?.cantidad).toBe(2);
    activarCuenta('c1');
    expect(useCarrito.getState().carrito.lineas[0]?.cantidad).toBe(2);
    activarCuenta(null);
    expect(useCarrito.getState().carrito.lineas[0]?.cantidad).toBe(1);
    expect(Object.keys(useCarrito.getState().borradores).sort()).toEqual([SIN_CUENTA, 'c1', 'c2']);
  });

  test('los borradores y la cuenta activa sobreviven a una recarga', async () => {
    const { agregar, activarCuenta, ponerCliente } = useCarrito.getState();
    agregar(brownie());
    activarCuenta('c1');
    agregar(brownie());
    ponerCliente('Luis');
    await esperarGuardado();
    await recargar();
    const estado = useCarrito.getState();
    expect(estado.cuentaActivaId).toBe('c1');
    expect(estado.carrito).toMatchObject({ cliente: 'Luis' });
    expect(estado.carrito.lineas).toHaveLength(1);
    expect(estado.borradores[SIN_CUENTA]?.lineas).toHaveLength(1);
  });

  test('un borrador vacío no se guarda', async () => {
    const { agregar, eliminar, activarCuenta } = useCarrito.getState();
    activarCuenta('c1');
    agregar(brownie());
    eliminar(useCarrito.getState().carrito.lineas[0]!.id);
    expect(useCarrito.getState().borradores).toEqual({});
    await esperarGuardado();
    expect(await leerMeta('borradores')).toEqual({});
  });

  test('pedido enviado: el borrador queda vacío y la cuenta pasa a ser la activa', () => {
    const { agregar, pedidoEnviado } = useCarrito.getState();
    agregar(brownie());
    pedidoEnviado('nueva');
    const estado = useCarrito.getState();
    expect(estado.cuentaActivaId).toBe('nueva');
    expect(estado.carrito.lineas).toHaveLength(0);
    expect(estado.borradores).toEqual({});
  });

  test('cobrar deja sin cuenta activa, sin borrador y con el resultado a la vista', async () => {
    const { agregar, activarCuenta, terminarVenta } = useCarrito.getState();
    activarCuenta('c1');
    agregar(brownie());
    terminarVenta({ ventaId: 'v1', folio: 'A-000001', cambio: 0, total: 4500 });
    const estado = useCarrito.getState();
    expect(estado.cuentaActivaId).toBeNull();
    expect(estado.borradores).toEqual({});
    expect(estado.ultimaVenta?.folio).toBe('A-000001');
    await esperarGuardado();
    expect(await leerMeta('cuentaActivaId')).toBeNull();
  });

  test('venta de mostrador: cobrar vacía el borrador sin cuenta', () => {
    const { agregar, terminarVenta } = useCarrito.getState();
    agregar(brownie());
    terminarVenta({ ventaId: 'v1', folio: 'A-000001', cambio: 0, total: 4500 });
    expect(useCarrito.getState().carrito.lineas).toHaveLength(0);
    expect(useCarrito.getState().borradores).toEqual({});
  });

  test('soltar una cuenta cobrada en otro dispositivo descarta su borrador', () => {
    const { agregar, activarCuenta, soltarCuenta } = useCarrito.getState();
    activarCuenta('c1');
    agregar(brownie());
    activarCuenta('c2');
    agregar(brownie());
    soltarCuenta('c1');
    expect(useCarrito.getState().cuentaActivaId).toBe('c2');
    expect(useCarrito.getState().borradores['c1']).toBeUndefined();
    soltarCuenta('c2');
    expect(useCarrito.getState().cuentaActivaId).toBeNull();
    expect(useCarrito.getState().carrito.lineas).toHaveLength(0);
  });

  test('un carrito guardado por una versión anterior se completa al cargar', async () => {
    const { actualizadoEn: _, ...linea } = { ...brownie(), actualizadoEn: '' };
    const { tamanoId: _t, ingredientesIds: _i, ...vieja } = linea;
    await bd.meta.put({
      clave: 'borradores',
      valor: { [SIN_CUENTA]: { lineas: [vieja], cliente: null, descuento: null } },
    });
    await recargar();
    expect(useCarrito.getState().carrito.lineas[0]).toMatchObject({ tamanoId: null, ingredientesIds: [] });
  });
});

/** Las escrituras a Dexie van sin esperar; deja que terminen. */
const esperarGuardado = () => new Promise((resolver) => setTimeout(resolver, 50));
