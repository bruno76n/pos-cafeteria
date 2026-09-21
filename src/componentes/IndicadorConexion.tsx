import { Cloud, CloudOff } from 'lucide-react';
import { useEstadoSync, useVentasPorSubir } from '@/datos/estadoSync';

/** "En línea" o "Sin conexión: 3 ventas por subir" (en celular, versión corta). */
export function IndicadorConexion() {
  const enLinea = useEstadoSync((s) => s.enLinea);
  const porSubir = useVentasPorSubir();
  const ventas = `${porSubir} ${porSubir === 1 ? 'venta' : 'ventas'} por subir`;
  const largo = enLinea
    ? porSubir > 0
      ? `En línea · ${ventas}`
      : 'En línea'
    : porSubir > 0
      ? `Sin conexión: ${ventas}`
      : 'Sin conexión';
  const corto = enLinea
    ? porSubir > 0
      ? `${porSubir}`
      : ''
    : porSubir > 0
      ? `Sin red · ${porSubir}`
      : 'Sin red';
  return (
    <span
      role="status"
      aria-label={largo}
      className={`flex shrink-0 items-center gap-2 text-etiqueta ${
        enLinea ? 'text-white/70' : 'rounded-boton bg-ambar-fondo px-3 py-1 font-semibold text-ambar'
      }`}
    >
      {enLinea ? <Cloud aria-hidden size={18} /> : <CloudOff aria-hidden size={18} />}
      <span aria-hidden className="max-sm:hidden">
        {largo}
      </span>
      {corto && (
        <span aria-hidden className="sm:hidden">
          {corto}
        </span>
      )}
    </span>
  );
}
