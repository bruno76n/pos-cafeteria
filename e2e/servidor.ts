// API para e2e: base PGlite nueva en una carpeta temporal por corrida.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.PGLITE_DIR = mkdtempSync(join(tmpdir(), 'pos-e2e-'));
await import('../scripts/dev-api');
