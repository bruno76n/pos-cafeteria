// Genera los íconos PNG de la PWA a partir de public/icono.svg (con el Chromium de Playwright).
// Uso: npx tsx scripts/generar-iconos.ts
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/icono.svg', 'utf8');
const salidas = [
  { archivo: 'public/icono-192.png', lado: 192, margen: 0 },
  { archivo: 'public/icono-512.png', lado: 512, margen: 0 },
  // Maskable: el sistema recorta en círculo; el dibujo va en la zona segura (80 %).
  { archivo: 'public/icono-maskable-512.png', lado: 512, margen: 0.1 },
  { archivo: 'public/apple-touch-icon.png', lado: 180, margen: 0 },
];

const navegador = await chromium.launch();
for (const { archivo, lado, margen } of salidas) {
  const pagina = await navegador.newPage({ viewport: { width: lado, height: lado } });
  const interior = Math.round(lado * (1 - margen * 2));
  await pagina.setContent(
    `<body style="margin:0;background:#1E2528;display:grid;place-items:center;height:${lado}px">
       <div style="width:${interior}px;height:${interior}px">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div>
     </body>`,
  );
  await pagina.screenshot({ path: archivo, omitBackground: margen === 0 });
  await pagina.close();
}
await navegador.close();
console.log('Íconos generados.');
