import { useEffect } from 'react';
import { useMeta } from '@/datos/consultas';

/** Aplica el tema del dispositivo en <html data-tema>: claro por defecto; automático sigue al sistema. */
export function useTema() {
  const tema = useMeta('tema') ?? 'claro';
  useEffect(() => {
    const sistema = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      const oscuro = tema === 'oscuro' || (tema === 'automatico' && sistema.matches);
      document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
    };
    aplicar();
    sistema.addEventListener('change', aplicar);
    return () => sistema.removeEventListener('change', aplicar);
  }, [tema]);
}
