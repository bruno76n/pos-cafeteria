import { Lock } from 'lucide-react';
import { useSesion } from '@/estado/sesion';
import { Boton } from './Boton';

/** "No tienes acceso" con opción de cambiar de usuario. */
export function SinAcceso({ accion }: { accion: string }) {
  const bloquear = useSesion((s) => s.bloquear);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <Lock aria-hidden size={40} className="text-grafito-suave" />
      <h1 className="text-seccion font-semibold">No tienes acceso</h1>
      <p className="text-grafito-suave">Tu usuario no puede {accion}.</p>
      <Boton variante="oscuro" tamano="grande" onClick={bloquear}>
        Cambiar usuario
      </Boton>
    </div>
  );
}
