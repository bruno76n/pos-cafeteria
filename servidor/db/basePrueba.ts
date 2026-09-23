// Base PGlite en memoria con las migraciones aplicadas, para pruebas.
import { conectarBaseDatos, type ConexionBaseDatos } from './cliente.js';
import { migrarBaseDatos } from './migrar.js';

export async function crearBasePrueba(): Promise<ConexionBaseDatos> {
  const conexion = await conectarBaseDatos({});
  await migrarBaseDatos(conexion);
  return conexion;
}
