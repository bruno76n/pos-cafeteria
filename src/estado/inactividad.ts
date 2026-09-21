import { useEffect } from 'react';
import { useMeta } from '@/datos/consultas';
import { useSesion } from './sesion';

/** Bloqueo automático tras N minutos sin tocar la pantalla (0 = nunca; configurable por dispositivo). */
export function useBloqueoPorInactividad() {
  const minutos = useMeta('bloqueoMinutos') ?? 0;
  const { registrarActividad, bloquear } = useSesion.getState();

  useEffect(() => {
    if (!minutos) return;
    registrarActividad();
    const alActuar = () => registrarActividad();
    window.addEventListener('pointerdown', alActuar);
    window.addEventListener('keydown', alActuar);
    const t = setInterval(() => {
      if (Date.now() - useSesion.getState().ultimaActividad >= minutos * 60_000) bloquear();
    }, 5_000);
    return () => {
      window.removeEventListener('pointerdown', alActuar);
      window.removeEventListener('keydown', alActuar);
      clearInterval(t);
    };
  }, [minutos, registrarActividad, bloquear]);
}
