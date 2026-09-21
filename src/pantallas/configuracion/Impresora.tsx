import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Segmentos } from '@/componentes/Segmentos';
import { guardarMeta } from '@/datos/bd';
import { useConfig, useMeta } from '@/datos/consultas';
import { DRIVERS, driversDisponibles, type TipoImpresora } from '@/impresion/drivers';
import type { ConexionGuardada } from '@/impresion/drivers/directa';
import { ticketDePrueba, useImpresora } from '@/impresion/usarImpresora';

/** Impresora de este dispositivo (se guarda localmente): conexión, conectar e "Imprimir prueba". */
export function ConfigImpresora() {
  const config = useConfig();
  const guardada = useMeta('impresora');
  const { imprimir, error, imprimiendo } = useImpresora();
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [, refrescar] = useState(0);
  const disponibles = driversDisponibles();
  const tipo: TipoImpresora =
    guardada && disponibles.some((d) => d.tipo === guardada.tipo) ? guardada.tipo : 'navegador';
  const driver = DRIVERS[tipo];
  const conexion = guardada?.tipo === tipo ? (guardada.reconexion as ConexionGuardada | null) : null;

  async function conectar() {
    setErrorConexion(null);
    try {
      const reconexion = await driver.conectar();
      await guardarMeta('impresora', { tipo, reconexion });
    } catch (e) {
      setErrorConexion((e as Error).message);
    }
    refrescar((n) => n + 1);
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-5"
      aria-labelledby="titulo-impresora"
    >
      <h2 id="titulo-impresora" className="text-seccion font-semibold">
        Impresora
      </h2>
      <Segmentos
        etiqueta="Conexión"
        valor={tipo}
        alCambiar={(t) => void guardarMeta('impresora', { tipo: t, reconexion: null })}
        opciones={disponibles.map((d) => ({
          valor: d.tipo,
          texto: d.tipo === 'navegador' ? 'Navegador' : d.nombre,
        }))}
      />
      {disponibles.length === 1 && (
        <p className="text-grafito-suave">En este dispositivo se imprime con el diálogo del sistema.</p>
      )}
      {tipo === 'bluetooth' && (
        <p className="text-etiqueta text-grafito-suave">Solo impresoras Bluetooth Low Energy.</p>
      )}
      {tipo !== 'navegador' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className={driver.estado() === 'conectada' ? 'font-semibold' : 'text-grafito-suave'}>
            {conexion
              ? `${conexion.nombre} · ${driver.estado() === 'conectada' ? 'conectada' : 'sin conectar'}`
              : 'Sin impresora'}
          </span>
          <Boton variante="oscuro" onClick={conectar}>
            {conexion ? 'Cambiar impresora' : 'Conectar'}
          </Boton>
        </div>
      )}
      {errorConexion && (
        <p className="text-faltante" role="alert">
          {errorConexion}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Boton disabled={!config || imprimiendo} onClick={() => config && imprimir(ticketDePrueba(config))}>
          <Printer aria-hidden /> {error ? 'Reintentar' : 'Imprimir prueba'}
        </Boton>
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
