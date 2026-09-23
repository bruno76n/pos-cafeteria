import { useState } from 'react';
import { Insignia } from '@/componentes/Insignia';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import { guardarMeta } from '@/datos/bd';
import { useDispositivos, useMeta } from '@/datos/consultas';
import { guardar } from '@/datos/escrituras';
import { useUsuarioActivo } from '@/estado/sesion';
import { useDispositivoActual } from '@/estado/dispositivo';
import { FormularioDispositivo } from '@/pantallas/acceso/FormularioDispositivo';
import { ConfigImpresora } from './Impresora';

const MINUTOS = ['0', '1', '5', '15', '30'] as const;

/**
 * Las demás tablets de la cuenta: nombre, tipo, folios y su interruptor de activo. Una tablet
 * desactivada deja de vender (su historial se conserva; los dispositivos nunca se borran).
 */
function OtrosDispositivos({ miId }: { miId: string }) {
  const dispositivos = useDispositivos();
  const otros = (dispositivos ?? []).filter((d) => d.id !== miId);
  if (otros.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-3 rounded-hoja border border-linea bg-papel p-5"
      aria-label="Otros dispositivos"
    >
      <h2 className="text-seccion font-semibold">Otros dispositivos</h2>
      <p className="text-etiqueta text-grafito-suave">
        Una tablet desactivada deja de vender y de abrir caja. Sus ventas y cortes se conservan.
      </p>
      <ul className="flex flex-col">
        {otros.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 border-t border-linea py-3">
            <span className="min-w-0 flex-1">
              <span className={`text-producto font-semibold ${d.activo ? '' : 'opacity-50'}`}>
                {d.nombre}
              </span>
              <span className="block text-etiqueta text-grafito-suave">
                {d.tipo === 'caja' ? `Folios ${d.prefijo}-…, último ${d.ultimoFolio}` : 'Solo consulta'}
              </span>
            </span>
            {!d.activo && <Insignia tono="ambar">Desactivada</Insignia>}
            <span className="flex items-center gap-2 text-etiqueta text-grafito-suave">
              Activa
              <Interruptor
                soloInterruptor
                etiqueta={`${d.nombre} activa`}
                activo={d.activo}
                alCambiar={(activo) => void guardar('dispositivos', { ...d, activo })}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Configuración de esta tablet: nombre, tipo, prefijo, bloqueo automático, almacenamiento e impresora. */
export function ConfigDispositivo() {
  const dispositivo = useDispositivoActual();
  const { esAdmin } = useUsuarioActivo();
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
      {esAdmin && <OtrosDispositivos miId={dispositivo.id} />}
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
