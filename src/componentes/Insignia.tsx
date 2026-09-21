import type { ReactNode } from 'react';

const TONOS = {
  neutro: 'bg-acero text-grafito-suave border-linea',
  ambar: 'bg-ambar-fondo text-ambar border-ambar/20',
  faltante: 'bg-faltante/10 text-faltante border-faltante/20',
  cafeto: 'bg-cafeto/10 text-cafeto border-cafeto/20',
};

export function Insignia({ tono = 'neutro', children }: { tono?: keyof typeof TONOS; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-etiqueta font-semibold ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}
