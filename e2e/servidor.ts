// API para e2e: base PGlite nueva (migrada y con datos demo) en una carpeta temporal por corrida.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sembrar } from '../scripts/seed';
import { conectarBaseDatos } from '../servidor/db/cliente';
import { migrarBaseDatos } from '../servidor/db/migrar';

const dirPglite = mkdtempSync(join(tmpdir(), 'pos-e2e-'));
const conexion = await conectarBaseDatos({ dirPglite });
await migrarBaseDatos(conexion);
if (process.env.E2E_SIN_DATOS !== '1') await sembrar(conexion.db);
await conexion.cerrar();

process.env.PGLITE_DIR = dirPglite;
await import('../scripts/dev-api');
