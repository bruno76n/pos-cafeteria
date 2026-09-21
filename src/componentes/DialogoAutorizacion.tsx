import { useConfig, useUsuarios } from '@/datos/consultas';
import { ACCION_PERMISO, autorizarConPin, ROLES_POR_DEFECTO } from '@/dominio/permisos';
import { useSolicitudAutorizacion } from '@/estado/autorizacion';
import { Hoja } from './Hoja';
import { TecladoPin } from './TecladoPin';

/** Diálogo de "Pedir autorización" (se monta una vez en el Shell). */
export function DialogoAutorizacion() {
  const solicitud = useSolicitudAutorizacion((s) => s.solicitud);
  const usuarios = useUsuarios();
  const config = useConfig();
  if (!solicitud) return null;

  async function verificar(pin: string) {
    const r = await autorizarConPin(
      usuarios ?? [],
      config?.roles ?? ROLES_POR_DEFECTO,
      solicitud!.permiso,
      pin,
    );
    if (r.ok) solicitud!.resolver(r.usuario);
    return r.ok ? true : r.motivo === 'pin' ? false : r.mensaje;
  }

  return (
    <Hoja titulo="Pedir autorización" centrada ancho="max-w-md" alCerrar={() => solicitud.resolver(null)}>
      <p className="mb-4 text-center text-grafito-suave">
        Un usuario que pueda {ACCION_PERMISO[solicitud.permiso]} escribe su PIN.
      </p>
      <TecladoPin verificar={verificar} />
    </Hoja>
  );
}
