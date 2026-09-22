import Dexie from 'dexie';
import { expect, test } from 'vitest';
import { BaseLocal } from './bd';

test('al actualizar la base, los productos guardados antes reciben sus campos nuevos', async () => {
  const nombre = 'actualizacion-bd';
  const vieja = new Dexie(nombre);
  vieja.version(1).stores({ productos: 'id, categoriaId, orden' });
  await vieja.table('productos').put({ id: 'latte', nombre: 'Latte', precio: 6500, gruposIds: ['leche'] });
  vieja.close();

  const nueva = new BaseLocal(nombre);
  expect(await nueva.productos.get('latte')).toMatchObject({
    precio: 6500,
    gruposIds: ['leche'],
    tamanos: [],
  });
  nueva.close();
});
