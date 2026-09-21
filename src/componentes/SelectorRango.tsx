import { clasesEntrada } from './Campo';
import {
  diaLocal,
  diasEntre,
  rangoPredefinido,
  type RangoDias,
  type RangoPredefinido,
} from '@/dominio/fechas';

export type TipoRango = RangoPredefinido | 'personalizado';

export interface EleccionRango {
  tipo: TipoRango;
  rango: RangoDias;
}

const PRESETS: { tipo: TipoRango; texto: string }[] = [
  { tipo: 'hoy', texto: 'Hoy' },
  { tipo: 'ayer', texto: 'Ayer' },
  { tipo: 'semana', texto: 'Esta semana' },
  { tipo: 'mes', texto: 'Este mes' },
  { tipo: 'personalizado', texto: 'Personalizado' },
];

export const rangoInicial = (): EleccionRango => ({ tipo: 'hoy', rango: rangoPredefinido('hoy') });

/** Hoy, Ayer, Esta semana, Este mes o Personalizado (máximo `maximoDias`). */
export function SelectorRango({
  valor,
  alCambiar,
  maximoDias = 92,
}: {
  valor: EleccionRango;
  alCambiar: (valor: EleccionRango) => void;
  maximoDias?: number;
}) {
  const hoy = diaLocal();
  const cambiarDia = (campo: 'desde' | 'hasta', dia: string) => {
    if (!dia) return;
    const nuevo: RangoDias = { ...valor.rango, [campo]: dia };
    let { desde, hasta } = nuevo;
    if (diasEntre(desde, hasta) < 0) [desde, hasta] = [hasta, desde];
    if (diasEntre(desde, hasta) >= maximoDias) {
      if (campo === 'desde') hasta = desde;
      else desde = hasta;
    }
    alCambiar({ tipo: 'personalizado', rango: { desde, hasta } });
  };
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Rango de fechas">
      {PRESETS.map((p) => (
        <button
          key={p.tipo}
          type="button"
          aria-pressed={valor.tipo === p.tipo}
          onClick={() =>
            alCambiar({
              tipo: p.tipo,
              rango: p.tipo === 'personalizado' ? valor.rango : rangoPredefinido(p.tipo, hoy),
            })
          }
          className={`min-h-12 rounded-boton border px-4 font-semibold ${
            valor.tipo === p.tipo ? 'border-grafito bg-grafito text-papel' : 'border-linea bg-papel'
          }`}
        >
          {p.texto}
        </button>
      ))}
      {valor.tipo === 'personalizado' && (
        <>
          <label className="flex flex-col gap-1 text-etiqueta text-grafito-suave">
            Desde
            <input
              type="date"
              className={clasesEntrada}
              max={hoy}
              value={valor.rango.desde}
              onChange={(e) => cambiarDia('desde', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-etiqueta text-grafito-suave">
            Hasta
            <input
              type="date"
              className={clasesEntrada}
              max={hoy}
              value={valor.rango.hasta}
              onChange={(e) => cambiarDia('hasta', e.target.value)}
            />
          </label>
        </>
      )}
    </div>
  );
}
