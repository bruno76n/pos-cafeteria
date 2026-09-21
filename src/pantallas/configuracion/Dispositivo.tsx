import { useState } from 'react';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import { guardarMeta } from '@/datos/bd';
import { useMeta } from '@/datos/consultas';
import { useDispositivoActual } from '@/estado/dispositivo';
import { FormularioDispositivo } from '@/pantallas/acceso/FormularioDispositivo';
import { ConfigImpresora } from './Impresora';

const MINUTOS = ['0', '1', '5', '15', '30'] as const;

/** Configuración de esta tablet: nombre, tipo, prefijo, bloqueo automático, almacenamiento e impresora. */
export function ConfigDispositivo() {
  const dispositivo = useDispositivoActual();
  const bloqueo = useMeta('bloqueoMinutos');
  const persistente = useMeta('almacenamientoPersistente');
  const tema = useMeta('tema');
  const [guardado, setGuardado] = useState(false);
  if (!dispositivo || bloqueo === undefined || persistente === undefined) return null;

  return (
    <Pantalla titulo="Dispositivo">
      <section className="rounded-hoja border border-linea bg-papel p-5" aria-label="Este dispositivo">
        <FormularioDispositivo
          key={dispositivo.actualizadoEn}
          actual={dispositivo}
          textoGuardar="Guardar dispositivo"
          alGuardar={() => setGuardado(true)}
        />
        {guardado && (
          <p className="mt-2 text-cafeto" role="status">
            Dispositivo guardado.
          </p>
        )}
      </section>
      <section
        className="flex flex-col gap-3 rounded-hoja border border-linea bg-papel p-5"
        aria-label="Bloqueo automático"
      >
        <Segmentos
          etiqueta="Bloqueo automático por inactividad"
          valor={String(bloqueo ?? 0) as (typeof MINUTOS)[number]}
          alCambiar={(m) => void guardarMeta('bloqueoMinutos', Number(m))}
          opciones={MINUTOS.map((m) => ({ valor: m, texto: m === '0' ? 'Nunca' : `${m} min` }))}
        />
      </section>
      <section className="rounded-hoja border border-linea bg-papel p-5" aria-label="Tema">
        <Segmentos
          etiqueta="Tema"
          valor={tema ?? 'claro'}
          alCambiar={(t) => void guardarMeta('tema', t)}
          opciones={[
            { valor: 'automatico', texto: 'Automático' },
            { valor: 'claro', texto: 'Claro' },
            { valor: 'oscuro', texto: 'Oscuro' },
          ]}
        />
      </section>
      <section className="rounded-hoja border border-linea bg-papel p-5" aria-label="Almacenamiento">
        <h2 className="mb-1 text-seccion font-semibold">Almacenamiento</h2>
        <p className={persistente ? 'text-cafeto' : 'text-ambar'}>
          {persistente
            ? 'Persistente: el navegador no borrará las ventas guardadas en esta tablet.'
            : 'No persistente: si falta espacio, el navegador podría borrar los datos locales. Instala la app para protegerlos.'}
        </p>
      </section>
      <ConfigImpresora />
    </Pantalla>
  );
}
