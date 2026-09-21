import { useState, type FormEvent } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Segmentos } from '@/componentes/Segmentos';
import { useDispositivos, useMeta } from '@/datos/consultas';
import { configurarDispositivo } from '@/datos/escrituras';
import { prefijoEnUso } from '@/dominio/folios';
import type { Dispositivo } from '@/dominio/tipos';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Nombre, tipo y prefijo de folio del dispositivo. Lo usan /dispositivo y Configuración › Dispositivo. */
export function FormularioDispositivo({
  actual,
  textoGuardar,
  alGuardar,
}: {
  actual: Dispositivo | null;
  textoGuardar: string;
  alGuardar?: () => void;
}) {
  const miId = useMeta('dispositivoId');
  const dispositivos = useDispositivos() ?? [];
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [tipo, setTipo] = useState<Dispositivo['tipo']>(actual?.tipo ?? 'caja');
  const [prefijo, setPrefijo] = useState<string | null>(actual?.prefijo ?? null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enUso = prefijo ? prefijoEnUso(prefijo, dispositivos, miId ?? '') : undefined;
  const usadoPor = (letra: string) => prefijoEnUso(letra, dispositivos, miId ?? '')?.nombre;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('Escribe el nombre del dispositivo.');
    if (tipo === 'caja' && !prefijo) return setError('Elige la letra de los folios.');
    setGuardando(true);
    await configurarDispositivo({ nombre, tipo, prefijo: tipo === 'caja' ? prefijo : null });
    setGuardando(false);
    setError(null);
    alGuardar?.();
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">
      <Campo
        etiqueta="Nombre"
        placeholder="Caja 1"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={40}
      />
      <Segmentos
        etiqueta="Tipo"
        valor={tipo}
        alCambiar={setTipo}
        opciones={[
          { valor: 'caja', texto: 'Caja (vende)' },
          { valor: 'consulta', texto: 'Consulta (solo ve y administra)' },
        ]}
      />
      {tipo === 'caja' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-etiqueta text-grafito-suave">
            Letra de los folios (A-000123). Cada caja usa una distinta.
          </legend>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
            {LETRAS.map((l) => {
              const otro = usadoPor(l);
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={prefijo === l}
                  aria-label={otro ? `${l} (la usa ${otro})` : l}
                  title={otro ? `La usa ${otro}` : undefined}
                  onClick={() => setPrefijo(l)}
                  className={`min-h-12 rounded-boton border text-producto font-semibold ${
                    prefijo === l
                      ? 'border-grafito bg-grafito text-papel'
                      : otro
                        ? 'border-dashed border-linea bg-acero text-grafito-suave'
                        : 'border-linea bg-papel'
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          {enUso && (
            <p className="rounded-boton bg-ambar-fondo p-3 text-ambar" role="alert">
              La letra {prefijo} ya la usa «{enUso.nombre}». Úsala solo si esta tablet reemplaza a esa caja;
              si no, los folios se repetirán.
            </p>
          )}
        </fieldset>
      )}
      {error && (
        <p className="text-faltante" role="alert">
          {error}
        </p>
      )}
      <Boton type="submit" variante="oscuro" tamano="grande" disabled={guardando}>
        {textoGuardar}
      </Boton>
    </form>
  );
}
