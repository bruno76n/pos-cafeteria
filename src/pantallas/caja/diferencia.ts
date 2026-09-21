import { tipoDiferencia } from '@/dominio/caja';
import { formatearDinero } from '@/dominio/dinero';

/** "Faltan $15.00" (rojo) / "Sobran $20.00" (verde) / "Cuadra exacto". */
export function textoDiferencia(diferencia: number): { texto: string; tono?: 'faltante' | 'cafeto' } {
  const tipo = tipoDiferencia(diferencia);
  if (tipo === 'faltante') return { texto: `Faltan ${formatearDinero(-diferencia)}`, tono: 'faltante' };
  if (tipo === 'sobrante') return { texto: `Sobran ${formatearDinero(diferencia)}`, tono: 'cafeto' };
  return { texto: 'Cuadra exacto' };
}
