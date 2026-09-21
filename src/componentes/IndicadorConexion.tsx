import { Cloud, CloudOff } from 'lucide-react';
import { useEstadoSync, useVentasPorSubir } from '@/datos/estadoSync';

/** "En línea" o "Sin conexión: 3 ventas por subir". */
export function IndicadorConexion() {
  const enLinea = useEstadoSync((s) => s.enLinea);
  const porSubir = useVentasPorSubir();
  const ventas = `${porSubir} ${porSubir === 1 ? 'venta' : 'ventas'} por subir`;
  if (enLinea) {
    return (
      <span className="flex items-center gap-2 text-etiqueta text-grafito-suave" role="status">
        <Cloud aria-hidden size={18} />
        {porSubir > 0 ? `En línea · ${ventas}` : 'En línea'}
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-2 rounded-boton bg-ambar-fondo px-3 py-1 text-etiqueta font-semibold text-ambar"
      role="status"
    >
      <CloudOff aria-hidden size={18} />
      {porSubir > 0 ? `Sin conexión: ${ventas}` : 'Sin conexión'}
    </span>
  );
}
