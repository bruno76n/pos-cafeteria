import { useState, type ReactNode } from 'react';
import { ACCION_PERMISO } from '@/dominio/permisos';
import type { Permiso } from '@/dominio/tipos';
import { pedirAutorizacion } from '@/estado/autorizacion';
import { useUsuarioActivo } from '@/estado/sesion';
import { Boton } from './Boton';

/**
 * Muestra el contenido si el usuario activo tiene el permiso. Si no: "Tu usuario no puede …"
 * con "Pedir autorización" (la autorización vale mientras la pantalla siga abierta).
 */
export function RequierePermiso({ permiso, children }: { permiso: Permiso; children: ReactNode }) {
  const { puede } = useUsuarioActivo();
  const [autorizado, setAutorizado] = useState(false);
  if (puede(permiso) || autorizado) return children;
  return (
    <div className="flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-producto">Tu usuario no puede {ACCION_PERMISO[permiso]}.</p>
      <Boton
        variante="oscuro"
        tamano="grande"
        onClick={async () => setAutorizado(Boolean(await pedirAutorizacion(permiso)))}
      >
        Pedir autorización
      </Boton>
    </div>
  );
}
