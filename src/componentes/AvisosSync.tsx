import { CircleAlert, CloudOff } from 'lucide-react';
import { useState } from 'react';
import { useErroresSync } from '@/datos/consultas';
import { describirError, reintentarErrorSync } from '@/datos/erroresSync';
import { useEstadoSync } from '@/datos/estadoSync';
import { useUsuarioActivo } from '@/estado/sesion';
import { Boton } from './Boton';

/** Aviso de "sin conexión" y, para el Administrador, las escrituras rechazadas con "Reintentar". */
export function AvisosSync() {
  const enLinea = useEstadoSync((s) => s.enLinea);
  const errores = useErroresSync() ?? [];
  const { esAdmin } = useUsuarioActivo();
  const [reintentando, setReintentando] = useState<string | null>(null);

  return (
    <div aria-live="polite">
      {!enLinea && (
        <p className="flex items-center gap-2 border-b border-linea bg-ambar-fondo px-4 py-2 text-etiqueta text-ambar">
          <CloudOff aria-hidden size={18} />
          Sin conexión. Las ventas se guardan en esta tablet y se suben solas.
        </p>
      )}
      {esAdmin &&
        errores.map((e) => (
          <div
            key={e.id}
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-linea bg-papel px-4 py-2 text-faltante"
          >
            <CircleAlert aria-hidden size={20} />
            <p className="flex-1">
              <span className="font-semibold">{describirError(e)} no se pudo subir.</span>{' '}
              <span className="text-etiqueta text-grafito-suave">{e.motivo}</span>
            </p>
            <Boton
              variante="claro"
              disabled={reintentando === e.id}
              onClick={async () => {
                setReintentando(e.id);
                await reintentarErrorSync(e.id);
                setReintentando(null);
              }}
            >
              Reintentar
            </Boton>
          </div>
        ))}
    </div>
  );
}
