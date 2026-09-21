import { ImagePlus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { Campo, clasesEntrada } from '@/componentes/Campo';
import { comprimirImagen } from '@/componentes/imagen';
import { Pantalla } from '@/componentes/Pantalla';
import type { ConfigGeneral } from '@/dominio/tipos';
import { useConfigEditable } from '@/estado/config';
import { BotonGuardar } from './Guardar';
import { VistaPreviaTicket } from './VistaPreviaTicket';

function Formulario({
  config,
  guardar,
}: {
  config: ConfigGeneral;
  guardar: (c: ConfigGeneral) => Promise<unknown>;
}) {
  const [negocio, setNegocio] = useState(config.negocio);
  const [categorias, setCategorias] = useState(config.gastos.categorias);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const cambiar = (cambios: Partial<ConfigGeneral['negocio']>) => setNegocio((n) => ({ ...n, ...cambios }));
  const borrador: ConfigGeneral = { ...config, negocio, gastos: { categorias } };

  function agregarCategoria() {
    const c = nuevaCategoria.trim();
    if (c && !categorias.includes(c)) setCategorias([...categorias, c]);
    setNuevaCategoria('');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-4 rounded-hoja bg-papel p-5">
        <Campo
          etiqueta="Nombre del negocio"
          value={negocio.nombre}
          maxLength={40}
          onChange={(e) => cambiar({ nombre: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-3">
          {negocio.logo && <img src={negocio.logo} alt="Logo" className="h-16 max-w-40 object-contain" />}
          <label className={clasesBoton('claro')}>
            <ImagePlus aria-hidden /> {negocio.logo ? 'Cambiar logo' : 'Agregar logo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const archivo = e.target.files?.[0];
                if (!archivo) return;
                setErrorLogo(null);
                try {
                  cambiar({ logo: await comprimirImagen(archivo, { lado: 384, cuadrado: false }) });
                } catch (err) {
                  setErrorLogo((err as Error).message);
                }
              }}
            />
          </label>
          {negocio.logo && (
            <Boton variante="fantasma" onClick={() => cambiar({ logo: null })}>
              Quitar logo
            </Boton>
          )}
          {errorLogo && <p className="text-faltante">{errorLogo}</p>}
        </div>
        <Campo
          etiqueta="Dirección"
          value={negocio.direccion}
          maxLength={120}
          onChange={(e) => cambiar({ direccion: e.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Teléfono"
            inputMode="tel"
            value={negocio.telefono}
            maxLength={20}
            onChange={(e) => cambiar({ telefono: e.target.value })}
          />
          <Campo
            etiqueta="RFC (opcional)"
            value={negocio.rfc}
            maxLength={13}
            onChange={(e) => cambiar({ rfc: e.target.value.toUpperCase() })}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-producto font-semibold">Categorías de gasto</legend>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <span
                key={c}
                className="inline-flex min-h-12 items-center gap-1 rounded-boton border border-linea pl-3"
              >
                {c}
                <button
                  type="button"
                  aria-label={`Quitar ${c}`}
                  className="flex size-11 items-center justify-center text-grafito-suave"
                  onClick={() => setCategorias(categorias.filter((x) => x !== c))}
                >
                  <X aria-hidden size={18} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              aria-label="Nueva categoría de gasto"
              placeholder="Nueva categoría"
              className={`${clasesEntrada} max-w-64`}
              value={nuevaCategoria}
              maxLength={30}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregarCategoria()}
            />
            <Boton onClick={agregarCategoria}>
              <Plus aria-hidden /> Agregar
            </Boton>
          </div>
        </fieldset>
        <BotonGuardar
          alGuardar={async () => {
            if (!negocio.nombre.trim()) return 'Escribe el nombre del negocio.';
            await guardar({ ...borrador, negocio: { ...negocio, nombre: negocio.nombre.trim() } });
            return null;
          }}
        />
      </div>
      <VistaPreviaTicket config={borrador} />
    </div>
  );
}

export function ConfigNegocio() {
  const { config, guardarConfig } = useConfigEditable();
  if (!config) return null;
  return (
    <Pantalla titulo="Negocio">
      <Formulario config={config} guardar={guardarConfig} />
    </Pantalla>
  );
}
