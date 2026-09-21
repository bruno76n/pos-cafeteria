import { describe, expect, test } from 'vitest';
import { autorizarConPin, esAdmin, puede, ROLES_POR_DEFECTO } from './permisos';
import { crearPin } from './pin';

const usuario = (rol: 'admin' | 'encargado' | 'cajero', activo = true) => ({ rol, activo });

describe('roles por defecto', () => {
  test('encargado', () => {
    const r = ROLES_POR_DEFECTO.encargado;
    expect(r.aplicarDescuentos && r.cancelarVentas && r.crearProductos && r.verReportes).toBe(true);
    expect(r.modificarPrecios).toBe(false);
  });
  test('cajero', () => {
    const r = ROLES_POR_DEFECTO.cajero;
    expect(r.vender && r.abrirCaja && r.cerrarCaja && r.registrarGastos).toBe(true);
    expect(
      r.aplicarDescuentos || r.cancelarVentas || r.modificarPrecios || r.crearProductos || r.verReportes,
    ).toBe(false);
  });
});

describe('puede', () => {
  test('admin siempre puede', () => {
    expect(puede(usuario('admin'), 'modificarPrecios', ROLES_POR_DEFECTO)).toBe(true);
    expect(esAdmin(usuario('admin'))).toBe(true);
    expect(esAdmin(usuario('encargado'))).toBe(false);
  });
  test('según la matriz editable', () => {
    expect(puede(usuario('cajero'), 'verReportes', ROLES_POR_DEFECTO)).toBe(false);
    const roles = {
      ...ROLES_POR_DEFECTO,
      cajero: { ...ROLES_POR_DEFECTO.cajero, verReportes: true, vender: false },
    };
    expect(puede(usuario('cajero'), 'verReportes', roles)).toBe(true);
    expect(puede(usuario('cajero'), 'vender', roles)).toBe(false);
  });
  test('usuario inactivo o ausente no puede nada', () => {
    expect(puede(usuario('admin', false), 'vender', ROLES_POR_DEFECTO)).toBe(false);
    expect(puede(null, 'vender', ROLES_POR_DEFECTO)).toBe(false);
  });
});

describe('autorizarConPin', () => {
  const ahora = '2026-09-19T00:00:00.000Z';
  async function usuarios() {
    return [
      {
        id: 'c',
        nombre: 'Cajero',
        rol: 'cajero' as const,
        activo: true,
        actualizadoEn: ahora,
        ...(await crearPin('1111')),
      },
      {
        id: 'e',
        nombre: 'Encargada',
        rol: 'encargado' as const,
        activo: true,
        actualizadoEn: ahora,
        ...(await crearPin('2222')),
      },
      {
        id: 'x',
        nombre: 'Ex',
        rol: 'admin' as const,
        activo: false,
        actualizadoEn: ahora,
        ...(await crearPin('3333')),
      },
    ];
  }
  test('otro usuario con el permiso autoriza', async () => {
    expect(await autorizarConPin(await usuarios(), ROLES_POR_DEFECTO, 'cancelarVentas', '2222')).toEqual({
      ok: true,
      usuario: { id: 'e', nombre: 'Encargada' },
    });
  });
  test('un usuario sin el permiso no autoriza', async () => {
    expect(await autorizarConPin(await usuarios(), ROLES_POR_DEFECTO, 'cancelarVentas', '1111')).toEqual({
      ok: false,
      motivo: 'sin-permiso',
      mensaje: 'Cajero tampoco puede cancelar ventas ni hacer devoluciones.',
    });
  });
  test('PIN incorrecto o de usuario inactivo', async () => {
    expect((await autorizarConPin(await usuarios(), ROLES_POR_DEFECTO, 'vender', '3333')).ok).toBe(false);
    expect((await autorizarConPin(await usuarios(), ROLES_POR_DEFECTO, 'vender', '0000')).ok).toBe(false);
  });
});
