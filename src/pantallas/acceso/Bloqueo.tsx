import { useConfig, useUsuarios } from '@/datos/consultas';
import { buscarUsuarioPorPin } from '@/dominio/pin';
import { useDispositivoActual } from '@/estado/dispositivo';
import { useSesion } from '@/estado/sesion';
import { TecladoPin } from '@/componentes/TecladoPin';

/** Pantalla de bloqueo: el PIN identifica al usuario. */
export function Bloqueo() {
  const config = useConfig();
  const dispositivo = useDispositivoActual();
  const usuarios = useUsuarios();
  const entrar = useSesion((s) => s.entrar);

  async function verificar(pin: string) {
    const usuario = await buscarUsuarioPorPin(usuarios ?? [], pin);
    if (usuario) entrar(usuario.id);
    return Boolean(usuario);
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 overflow-y-auto p-4">
      <p className="text-seccion font-semibold">{config?.negocio.nombre}</p>
      <p className="text-grafito-suave">{dispositivo?.nombre}</p>
      <h1 className="mt-6 text-pantalla font-bold">Escribe tu PIN</h1>
      <TecladoPin verificar={verificar} />
    </main>
  );
}
