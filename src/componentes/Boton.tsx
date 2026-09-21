import type { ButtonHTMLAttributes } from 'react';

export type VarianteBoton = 'dinero' | 'oscuro' | 'claro' | 'peligro' | 'fantasma';
export type TamanoBoton = 'normal' | 'grande' | 'enorme';

const VARIANTES: Record<VarianteBoton, string> = {
  // Cafeto: solo acciones de dinero y confirmación.
  dinero: 'bg-cafeto text-papel active:bg-cafeto-oscuro',
  oscuro: 'bg-grafito text-papel active:bg-black',
  claro: 'bg-papel text-grafito border border-linea active:bg-acero',
  peligro: 'bg-papel text-faltante border border-faltante/40 active:bg-faltante/10',
  fantasma: 'bg-transparent text-grafito active:bg-linea/60',
};

const TAMANOS: Record<TamanoBoton, string> = {
  normal: 'min-h-12 px-4 text-normal',
  grande: 'min-h-16 px-5 text-producto',
  enorme: 'min-h-18 px-6 text-seccion',
};

export function clasesBoton(variante: VarianteBoton = 'claro', tamano: TamanoBoton = 'normal') {
  return `inline-flex select-none items-center justify-center gap-2 rounded-boton font-semibold transition-transform duration-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${VARIANTES[variante]} ${TAMANOS[tamano]}`;
}

export interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
}

export function Boton({ variante, tamano, className = '', type = 'button', ...props }: PropsBoton) {
  return <button type={type} className={`${clasesBoton(variante, tamano)} ${className}`} {...props} />;
}
