import type { FilaCifra } from '@/componentes/TablaCifras';
import { formatearDinero } from '@/dominio/dinero';
import type { ResumenTurno } from '@/dominio/tipos';

/** Totales del turno (ventas por método, entradas, retiros, gastos, devoluciones). */
export function filasTotalesTurno(r: ResumenTurno): FilaCifra[] {
  return [
    { etiqueta: 'Fondo inicial', valor: formatearDinero(r.fondoInicial) },
    { etiqueta: `Ventas (${r.ventas})`, valor: formatearDinero(r.totalVendido), fuerte: true },
    { etiqueta: 'Efectivo', valor: formatearDinero(r.porMetodo.efectivo) },
    { etiqueta: 'Tarjeta', valor: formatearDinero(r.porMetodo.tarjeta) },
    { etiqueta: 'Transferencia', valor: formatearDinero(r.porMetodo.transferencia) },
    { etiqueta: 'Entradas', valor: formatearDinero(r.entradas) },
    { etiqueta: 'Retiros', valor: formatearDinero(r.retiros) },
    { etiqueta: 'Gastos', valor: formatearDinero(r.gastos.total) },
    { etiqueta: `Devoluciones en efectivo`, valor: formatearDinero(r.devoluciones.efectivo) },
    {
      etiqueta: `Cancelaciones (${r.cancelaciones.cantidad})`,
      valor: formatearDinero(r.cancelaciones.importe),
    },
  ];
}
