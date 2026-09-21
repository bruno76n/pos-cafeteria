import type { ReactNode } from 'react';

export interface FilaCifra {
  etiqueta: ReactNode;
  valor: ReactNode;
  fuerte?: boolean;
  /** Color del valor: faltante (rojo) o cafeto (verde). */
  tono?: 'faltante' | 'cafeto';
}

/** Renglones etiqueta / cifra alineada a la derecha. */
export function TablaCifras({ filas, className = '' }: { filas: FilaCifra[]; className?: string }) {
  return (
    <dl className={`flex flex-col ${className}`}>
      {filas.map((f, i) => (
        <div
          key={i}
          className={`flex items-baseline justify-between gap-4 border-b border-linea py-2 last:border-b-0 ${
            f.fuerte ? 'text-producto font-semibold' : ''
          }`}
        >
          <dt className={f.fuerte ? '' : 'text-grafito-suave'}>{f.etiqueta}</dt>
          <dd
            className={`cifras text-right ${f.tono === 'faltante' ? 'text-faltante' : f.tono === 'cafeto' ? 'text-cafeto' : ''}`}
          >
            {f.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
