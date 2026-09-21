import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './servidor/db/esquema.ts',
  out: './drizzle',
  casing: 'snake_case',
});
