import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'app',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            setupFiles: ['src/pruebas.setup.ts'],
          },
        },
        {
          extends: true,
          test: { name: 'servidor', environment: 'node', include: ['servidor/**/*.test.ts', 'scripts/**/*.test.ts'] },
        },
      ],
    },
  }),
);
