import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

export type BaseDatos = PgDatabase<PgQueryResultHKT>;

export interface ConexionBaseDatos {
  db: BaseDatos;
  /** 'neon' en producción; 'pglite' en desarrollo y pruebas. */
  tipo: 'neon' | 'pglite';
  cerrar: () => Promise<void>;
}

/**
 * Elige el driver: con `DATABASE_URL`, Neon HTTP; sin ella, PGlite
 * (en `dirPglite`, o en memoria si no se indica carpeta).
 */
export async function conectarBaseDatos(opciones: {
  databaseUrl?: string;
  dirPglite?: string;
}): Promise<ConexionBaseDatos> {
  if (opciones.databaseUrl) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const db = drizzle(neon(opciones.databaseUrl)) as unknown as BaseDatos;
    return { db, tipo: 'neon', cerrar: async () => {} };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const cliente = new PGlite(opciones.dirPglite);
  const db = drizzle(cliente) as unknown as BaseDatos;
  return { db, tipo: 'pglite', cerrar: () => cliente.close() };
}
