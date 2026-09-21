import { describe, expect, test } from 'vitest';
import { esAdmin, puede, ROLES_POR_DEFECTO } from './permisos';

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
