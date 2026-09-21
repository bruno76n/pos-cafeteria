import { useEffect, useState } from 'react';
import { DIAS_LOCALES, diaLocal, sumarDias, type RangoDias } from '@/dominio/fechas';
import type { DatosReporte } from '@/dominio/reportes';
import { api, ErrorApi } from './api';
import { leerMeta } from './bd';
import { useDatosDelRango } from './consultas';
import { useEstadoSync } from './estadoSync';

export const MENSAJE_FUERA_DE_RANGO_SIN_RED = 'Sin conexión: solo están disponibles los últimos 35 días.';
export const MENSAJE_LOCAL_SIN_RED = 'Sin conexión: puede faltar información reciente de otros dispositivos.';

/** ¿El rango cabe en los días que guarda la tablet? */
export const rangoEsLocal = (rango: RangoDias, hoy = diaLocal()) =>
  rango.desde >= sumarDias(hoy, -DIAS_LOCALES);

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; datos: DatosReporte; aviso: string | null }
  | { tipo: 'error'; mensaje: string };

/**
 * Datos para Reportes: de la tablet si el rango cabe en los últimos 35 días (sirve sin conexión);
 * si no, de GET /api/reportes (requiere internet). Es la única lectura de pantalla que espera a la red.
 */
export function useDatosReporte(rango: RangoDias): Estado {
  const local = rangoEsLocal(rango);
  const datosLocales = useDatosDelRango(local ? rango : { desde: '', hasta: '' });
  const enLinea = useEstadoSync((s) => s.enLinea);
  const [remoto, setRemoto] = useState<{ clave: string; estado: Estado } | null>(null);
  const clave = `${rango.desde}_${rango.hasta}`;

  useEffect(() => {
    if (local) return;
    let vigente = true;
    void (async () => {
      const sesion = await leerMeta('sesion');
      try {
        if (!sesion || sesion.expirada)
          throw new ErrorApi('sesion', 'Vuelve a iniciar sesión para consultar el servidor.');
        const [desde = '', hasta = ''] = clave.split('_');
        const datos = await api.reportes(sesion.token, { desde, hasta });
        if (vigente) setRemoto({ clave, estado: { tipo: 'listo', datos, aviso: null } });
      } catch (e) {
        const mensaje =
          e instanceof ErrorApi && e.tipo === 'red' ? MENSAJE_FUERA_DE_RANGO_SIN_RED : (e as Error).message;
        if (vigente) setRemoto({ clave, estado: { tipo: 'error', mensaje } });
      }
    })();
    return () => {
      vigente = false;
    };
  }, [local, clave]);

  if (local) {
    if (!datosLocales) return { tipo: 'cargando' };
    return { tipo: 'listo', datos: datosLocales, aviso: enLinea ? null : MENSAJE_LOCAL_SIN_RED };
  }
  return remoto?.clave === clave ? remoto.estado : { tipo: 'cargando' };
}
