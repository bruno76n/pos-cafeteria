import { useEffect } from 'react';
import { useMeta } from '@/datos/consultas';

/** Aplica el tema del dispositivo (automático sigue al sistema) en <html data-tema>. */
export function useTema() {
  const tema = useMeta('tema') ?? 'automatico';
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
