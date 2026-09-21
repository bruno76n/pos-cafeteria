import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Hoja } from '@/componentes/Hoja';
import { Insignia } from '@/componentes/Insignia';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import { useUsuarios } from '@/datos/consultas';
import { guardar } from '@/datos/escrituras';
import { NOMBRE_ROL, validarUltimoAdmin } from '@/dominio/permisos';
import { crearPin, esPinValido, pinEnUso } from '@/dominio/pin';
import type { Rol, Usuario } from '@/dominio/tipos';

interface Edicion {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  nuevo: boolean;
}

const soloNumeros = (v: string) => v.replace(/\D/g, '').slice(0, 6);

function FormularioUsuario({
  inicial,
  usuarios,
  alCerrar,
}: {
  inicial: Edicion;
  usuarios: Usuario[];
  alCerrar: () => void;
}) {
  const [u, setU] = useState(inicial);
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (cambios: Partial<Edicion>) => setU((x) => ({ ...x, ...cambios }));
  const existente = usuarios.find((x) => x.id === u.id);

  async function guardarUsuario() {
    if (!u.nombre.trim()) return setError('Escribe el nombre.');
    const ultimo = validarUltimoAdmin(usuarios, u);
    if (ultimo) return setError(ultimo);
    if (u.nuevo || pin) {
      if (!esPinValido(pin)) return setError('El PIN debe tener de 4 a 6 números.');
      if (pin !== confirmacion) return setError('Los PIN no coinciden.');
      if (await pinEnUso(usuarios, pin, u.id)) return setError('Ese PIN ya lo usa otro usuario. Elige otro.');
    }
    setGuardando(true);
    const credenciales = pin
      ? await crearPin(pin)
      : { pinHash: existente!.pinHash, pinSal: existente!.pinSal };
    await guardar('usuarios', {
      id: u.id,
      nombre: u.nombre.trim(),
      rol: u.rol,
      activo: u.activo,
      ...credenciales,
    });
    alCerrar();
  }

  return (
    <Hoja
      titulo={u.nuevo ? 'Nuevo usuario' : `Editar ${inicial.nombre}`}
      centrada
      ancho="max-w-lg"
      alCerrar={alCerrar}
      pie={
        <div className="flex justify-end">
          <Boton variante="oscuro" tamano="grande" disabled={guardando} onClick={guardarUsuario}>
            Guardar
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre"
          value={u.nombre}
          maxLength={30}
          onChange={(e) => cambiar({ nombre: e.target.value })}
        />
        <Segmentos
          etiqueta="Rol"
          valor={u.rol}
          alCambiar={(rol) => cambiar({ rol })}
          opciones={(['admin', 'encargado', 'cajero'] as const).map((r) => ({
            valor: r,
            texto: NOMBRE_ROL[r],
          }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta={u.nuevo ? 'PIN (4 a 6 números)' : 'PIN nuevo (opcional)'}
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
          etiqueta="Activo"
          descripcion="Los usuarios no se borran: se desactivan y sus ventas guardan su nombre."
          activo={u.activo}
          alCambiar={(activo) => cambiar({ activo })}
        />
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  );
}

/** Usuarios: nombre, rol y estado; crear y editar (PIN único, protección del último Administrador). */
export function Usuarios() {
  const usuarios = useUsuarios();
  const [editando, setEditando] = useState<Edicion | null>(null);
  if (!usuarios) return null;
  const ordenados = [...usuarios].sort(
    (a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'),
  );

  return (
    <Pantalla
      titulo="Usuarios"
      acciones={
        <Boton
          variante="oscuro"
          onClick={() =>
            setEditando({ id: crypto.randomUUID(), nombre: '', rol: 'cajero', activo: true, nuevo: true })
          }
        >
          <Plus aria-hidden /> Nuevo usuario
        </Boton>
      }
    >
      <ul className="flex flex-col rounded-hoja bg-papel">
        {ordenados.map((u) => (
          <li
            key={u.id}
            className="flex min-h-16 items-center gap-3 border-b border-linea px-4 py-2 last:border-b-0"
          >
            <span className={`flex-1 text-producto font-semibold ${u.activo ? '' : 'text-grafito-suave'}`}>
              {u.nombre}
            </span>
            <span className="w-32 text-grafito-suave">{NOMBRE_ROL[u.rol]}</span>
            <span className="w-24">
              {u.activo ? <Insignia tono="cafeto">Activo</Insignia> : <Insignia>Inactivo</Insignia>}
            </span>
            <Boton
              variante="fantasma"
              aria-label={`Editar ${u.nombre}`}
              onClick={() =>
                setEditando({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo, nuevo: false })
              }
            >
              <Pencil aria-hidden size={18} /> Editar
            </Boton>
          </li>
        ))}
      </ul>
      {editando && (
        <FormularioUsuario inicial={editando} usuarios={usuarios} alCerrar={() => setEditando(null)} />
      )}
    </Pantalla>
  );
}
