import { Coffee } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { useMeta } from '@/datos/consultas';
import { iniciarSesion } from '@/datos/sesion';
import { MENSAJE_SESION_EXPIRADA } from '@/datos/sync';

/** Inicio de sesión de la cuenta (una vez por dispositivo). */
export function Acceso() {
  const sesion = useMeta('sesion');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const correoMostrado = correo || sesion?.cuenta.correo || '';

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await iniciarSesion(correoMostrado, contrasena);
    setEnviando(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <main className="flex h-full items-center justify-center overflow-y-auto p-4">
      <form
        onSubmit={entrar}
        className="flex w-full max-w-md flex-col gap-4 rounded-hoja border border-linea bg-papel p-6"
      >
        <div className="flex items-center gap-3">
          <Coffee aria-hidden size={32} />
          <h1 className="text-pantalla font-bold">POS Cafetería</h1>
        </div>
        {sesion?.expirada ? (
          <p className="rounded-boton bg-ambar-fondo p-3 text-ambar" role="alert">
            {MENSAJE_SESION_EXPIRADA} Las ventas guardadas en esta tablet se subirán al entrar.
          </p>
        ) : (
          <p className="text-grafito-suave">Inicia sesión con la cuenta de la cafetería.</p>
        )}
        <Campo
          etiqueta="Correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={correoMostrado}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" variante="oscuro" tamano="grande" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>
    </main>
  );
}
