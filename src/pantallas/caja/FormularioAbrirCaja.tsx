import { useState, type FormEvent } from 'react';
import { Boton } from '@/componentes/Boton';
import { CampoDinero } from '@/componentes/CampoDinero';
import { abrirTurno } from '@/datos/escrituras';
import { useAutorizar } from '@/estado/autorizacion';

/** Fondo inicial y "Abrir caja" (requiere abrirCaja o autorización). */
export function FormularioAbrirCaja({ alAbrir }: { alAbrir?: () => void }) {
  const autorizar = useAutorizar();
  const [fondo, setFondo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    if (fondo === null) return setError('Escribe el fondo inicial (0 si no hay).');
    const permitido = await autorizar('abrirCaja');
    if (!permitido) return;
    try {
      await abrirTurno({ fondoInicial: fondo, usuario: permitido.usuario });
      alAbrir?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={abrir} className="flex w-full max-w-sm flex-col gap-4">
      <CampoDinero etiqueta="Fondo inicial" valor={fondo} alCambiar={setFondo} error={error} />
      <Boton type="submit" variante="oscuro" tamano="grande">
        Abrir caja
      </Boton>
    </form>
  );
}
