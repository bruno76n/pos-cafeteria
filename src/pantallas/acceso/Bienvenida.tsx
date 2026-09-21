import { useState, type FormEvent } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Interruptor } from '@/componentes/Interruptor';
import { inicializarNegocio } from '@/datos/escrituras';
import { esPinValido } from '@/dominio/pin';
import { useSesion } from '@/estado/sesion';

/** Asistente inicial: solo aparece si no hay configuración ni local ni en el servidor. */
export function Bienvenida() {
  const entrar = useSesion((s) => s.entrar);
  const [negocio, setNegocio] = useState('');
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [cargarMenu, setCargarMenu] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function empezar(e: FormEvent) {
    e.preventDefault();
    if (!negocio.trim()) return setError('Escribe el nombre del negocio.');
    if (!nombre.trim()) return setError('Escribe el nombre del Administrador.');
    if (!esPinValido(pin)) return setError('El PIN debe tener de 4 a 6 números.');
    if (pin !== confirmacion) return setError('Los PIN no coinciden.');
    setGuardando(true);
    const admin = await inicializarNegocio({ nombreNegocio: negocio, admin: { nombre, pin }, cargarMenu });
    entrar(admin.id);
  }

  const soloNumeros = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  return (
    <main className="flex h-full justify-center overflow-y-auto p-4">
      <form
        onSubmit={empezar}
        className="flex w-full max-w-2xl flex-col gap-5 self-start rounded-hoja border border-linea bg-papel p-6"
      >
        <div>
          <h1 className="text-pantalla font-bold">Bienvenida</h1>
          <p className="text-grafito-suave">Tres datos y listo para vender.</p>
        </div>
        <Campo etiqueta="Nombre del negocio" value={negocio} onChange={(e) => setNegocio(e.target.value)} />
        <h2 className="text-seccion font-semibold">Administrador</h2>
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="PIN (4 a 6 números)"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(soloNumeros(e.target.value))}
          />
          <Campo
            etiqueta="Confirma el PIN"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(soloNumeros(e.target.value))}
          />
        </div>
        <Interruptor
          etiqueta="Cargar menú de ejemplo"
          descripcion="Cafés, bebidas frías, alimentos y postres con sus modificadores. Lo puedes editar después."
          activo={cargarMenu}
          alCambiar={setCargarMenu}
        />
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" variante="oscuro" tamano="grande" disabled={guardando}>
          Empezar
        </Boton>
      </form>
    </main>
  );
}
