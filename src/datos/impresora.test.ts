import { expect, test } from 'vitest';
import { normalizarConfigImpresora } from '@/impresion/configImpresora';
import { BaseLocal, guardarMeta } from './bd';
import { cambiarConfigImpresora, leerConfigImpresora } from './impresora';

test('la impresora se guarda en el dispositivo y sigue ahí al recargar', async () => {
  await cambiarConfigImpresora({ tipo: 'rawbt', ancho: 80 });
  await cambiarConfigImpresora({ avance: 5, cortar: true, copias: 2, imprimirAlCobrar: true });

  // "Recargar": otra conexión a la misma base local, como la abre la app al iniciar.
  const recargada = new BaseLocal();
  const guardada = normalizarConfigImpresora((await recargada.meta.get('impresora'))?.valor);
  recargada.close();
  expect(guardada).toMatchObject({
    tipo: 'rawbt',
    ancho: 80,
    avance: 5,
    cortar: true,
    copias: 2,
    imprimirAlCobrar: true,
  });
});

test('la configuración guardada por la versión anterior se lee completa', async () => {
  await guardarMeta('impresora', {
    tipo: 'bluetooth',
    reconexion: { id: 'BT-9', nombre: 'MTP-II' },
  } as never);
  expect(await leerConfigImpresora()).toMatchObject({
    tipo: 'bluetooth',
    dispositivo: { id: 'BT-9', nombre: 'MTP-II' },
    ancho: 58,
    avance: 3,
  });
});
