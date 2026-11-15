import { useState, type FormEvent } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Hoja } from '@/componentes/Hoja';
import { abrirCuenta } from '@/datos/escrituras';
import type { Cuenta, Dispositivo, Turno } from '@/dominio/tipos';
import { refUsuario, useUsuarioActivo } from '@/estado/sesion';

/** Hoja para abrir una cuenta vacía con un nombre opcional. */
export function DialogoNuevaCuenta({
  turno,
  dispositivo,
  alAbrir,
  alCerrar,
}: {
  turno: Pick<Turno, 'id'>;
  dispositivo: Pick<Dispositivo, 'id' | 'nombre'>;
  alAbrir: (cuenta: Cuenta) => void;
  alCerrar: () => void;
}) {
  const { usuario } = useUsuarioActivo();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);

  async function abrir(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    setAbriendo(true);
    try {
      alAbrir(await abrirCuenta({ nombre, turno, dispositivo, usuario: refUsuario(usuario) }));
    } catch (err) {
      setError((err as Error).message);
      setAbriendo(false);
    }
  }

  return (
    <Hoja titulo="Nueva cuenta" centrada ancho="max-w-md" alCerrar={alCerrar}>
      <form onSubmit={abrir} className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre (opcional)"
          value={nombre}
          maxLength={40}
          placeholder="Para llamarlo cuando esté listo"
          error={error}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Boton type="submit" variante="oscuro" tamano="grande" disabled={abriendo}>
          Abrir cuenta
        </Boton>
      </form>
    </Hoja>
  );
}
