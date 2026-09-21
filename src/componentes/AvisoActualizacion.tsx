import { useRegisterSW } from 'virtual:pwa-register/react';
import { useCarrito } from '@/estado/carrito';
import { Boton } from './Boton';

/**
 * "Hay una versión nueva." con "Actualizar". Solo aparece con el carrito vacío y nunca recarga
 * sola: una venta a medias no se interrumpe.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayNueva],
    updateServiceWorker,
  } = useRegisterSW();
  const carritoVacio = useCarrito((s) => s.carrito.lineas.length === 0);
  if (!hayNueva || !carritoVacio) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-hoja bg-grafito px-4 py-3 text-papel shadow-xl portrait:bottom-24"
    >
      <span>Hay una versión nueva.</span>
      <Boton variante="claro" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </Boton>
    </div>
  );
}
