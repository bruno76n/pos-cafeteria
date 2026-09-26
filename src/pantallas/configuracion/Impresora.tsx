import { Bluetooth, Printer, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Insignia } from '@/componentes/Insignia';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import { useConfig } from '@/datos/consultas';
import { cambiarConfigImpresora, useConfigImpresora } from '@/datos/impresora';
import {
  AVANCE_MAXIMO,
  COPIAS_MAXIMAS,
  columnasDeImpresora,
  type ConfigImpresora as Config,
  type Densidad,
  type TipoImpresora,
} from '@/impresion/configImpresora';
import {
  DRIVERS,
  driversDisponibles,
  ErrorImpresion,
  MENSAJES_IMPRESORA,
  type EstadoConexion,
} from '@/impresion/drivers';
import { ticketDePrueba, useEstadoImpresora, useImpresora } from '@/impresion/usarImpresora';

const NOMBRE_TIPO: Record<TipoImpresora, string> = {
  bluetooth: 'Bluetooth',
  rawbt: 'RawBT',
  sistema: 'Sistema',
};

const INSIGNIA_ESTADO: Record<EstadoConexion, { tono: 'cafeto' | 'neutro' | 'ambar'; texto: string }> = {
  conectada: { tono: 'cafeto', texto: 'Conectada' },
  desconectada: { tono: 'neutro', texto: 'Desconectada' },
  buscando: { tono: 'ambar', texto: 'Buscando' },
};

const numeros = (desde: number, hasta: number) =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i));

type Aviso = { tipo: 'ok' | 'error'; mensaje: string; ayuda?: string | undefined } | null;

function Mensaje({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return aviso.tipo === 'ok' ? (
    <p className="font-semibold text-cafeto" role="status">
      {aviso.mensaje}
    </p>
  ) : (
    <div role="alert" className="flex flex-col gap-1">
      <p className="font-semibold text-faltante">{aviso.mensaje}</p>
      {aviso.ayuda && <p className="text-grafito-suave">{aviso.ayuda}</p>}
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section
      className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-5"
      aria-label={titulo}
    >
      <h2 className="text-seccion font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

/** Buscar, estado y olvidar la impresora Bluetooth (Web Bluetooth). */
function PanelBluetooth({ config, alAvisar }: { config: Config; alAvisar: (a: Aviso) => void }) {
  const driver = DRIVERS.bluetooth;
  const estado = useEstadoImpresora(driver);
  const insignia = INSIGNIA_ESTADO[estado];

  async function buscar() {
    alAvisar(null);
    try {
      const dispositivo = await driver.conectar();
      await cambiarConfigImpresora({ dispositivo });
      alAvisar({ tipo: 'ok', mensaje: MENSAJES_IMPRESORA.conectada });
    } catch (e) {
      const error = e instanceof ErrorImpresion ? e : new ErrorImpresion(MENSAJES_IMPRESORA.conexionPerdida);
      alAvisar({ tipo: 'error', mensaje: error.message, ayuda: error.ayuda });
    }
  }

  async function olvidar() {
    await driver.olvidar(config);
    await cambiarConfigImpresora({ dispositivo: null });
    alAvisar(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Bluetooth aria-hidden className="text-grafito-suave" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{config.dispositivo?.nombre ?? 'Sin impresora elegida'}</span>
          <span className="text-etiqueta text-grafito-suave">
            Solo impresoras Bluetooth Low Energy, en Chrome (Android o computadora) con HTTPS.
          </span>
        </span>
        {config.dispositivo && (
          <span aria-live="polite">
            <Insignia tono={insignia.tono}>{insignia.texto}</Insignia>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Boton variante="oscuro" disabled={estado === 'buscando'} onClick={buscar}>
          <Search aria-hidden /> Buscar impresora
        </Boton>
        {config.dispositivo && estado !== 'conectada' && (
          <Boton disabled={estado === 'buscando'} onClick={() => void driver.reconectar(config)}>
            Reconectar
          </Boton>
        )}
        {config.dispositivo && (
          <Boton variante="peligro" onClick={olvidar}>
            <Trash2 aria-hidden /> Olvidar impresora
          </Boton>
        )}
      </div>
    </div>
  );
}

function NotaRawBT() {
  return (
    <div className="flex flex-col gap-1 text-grafito-suave">
      <p>
        RawBT es una app de Android que imprime en impresoras Bluetooth clásico (las que el navegador no ve).
        El POS le manda el ticket y RawBT lo imprime.
      </p>
      <p>
        Cómo instalarla: en la tablet, busca «RawBT» en Google Play e instálala; empareja la impresora en
        Ajustes › Bluetooth; abre RawBT, elige la impresora y regresa aquí a «Imprimir prueba».
      </p>
    </div>
  );
}

/** Impresora de este dispositivo (se guarda localmente, no se sincroniza). */
export function ConfigImpresora() {
  const configNegocio = useConfig();
  const config = useConfigImpresora();
  const { imprimir, fallo, imprimiendo } = useImpresora();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pruebaEnviada, setPruebaEnviada] = useState(false);
  if (!config) return null;

  const disponibles = driversDisponibles();
  const tipo: TipoImpresora = disponibles.some((d) => d.tipo === config.tipo) ? config.tipo : 'sistema';
  const hayDirectas = disponibles.length > 1;
  const esEscPos = tipo !== 'sistema';
  const cambiar = (cambios: Partial<Config>) => void cambiarConfigImpresora(cambios);

  async function prueba() {
    if (!configNegocio) return;
    setPruebaEnviada(false);
    setAviso(null);
    setPruebaEnviada(await imprimir(ticketDePrueba(configNegocio, columnasDeImpresora(config!))));
  }

  return (
    <Pantalla titulo="Impresora">
      <p className="text-grafito-suave">
        Se guarda solo en esta tablet. Cada tablet puede tener su propia impresora.
      </p>
      <Tarjeta titulo="Conexión">
        <Segmentos
          etiqueta="Tipo de conexión"
          valor={tipo}
          alCambiar={(t) => {
            setAviso(null);
            cambiar({ tipo: t });
          }}
          opciones={disponibles.map((d) => ({ valor: d.tipo, texto: NOMBRE_TIPO[d.tipo] }))}
        />
        {!hayDirectas && (
          <p className="text-grafito-suave">
            Este navegador no puede conectarse directo a una impresora: Bluetooth necesita Chrome en Android o
            computadora con HTTPS, y RawBT solo existe en Android. Se imprime con el diálogo de impresión del
            sistema.
          </p>
        )}
        {tipo === 'bluetooth' && <PanelBluetooth config={config} alAvisar={setAviso} />}
        {tipo === 'rawbt' && <NotaRawBT />}
        {tipo === 'sistema' && hayDirectas && (
          <p className="text-grafito-suave">
            Abre el diálogo de impresión del navegador. Ahí se eligen la impresora y las copias.
          </p>
        )}
        <Mensaje aviso={aviso} />
      </Tarjeta>

      <Tarjeta titulo="Papel">
        <Segmentos
          etiqueta="Ancho de papel"
          valor={String(config.ancho) as '58' | '80'}
          alCambiar={(a) => cambiar({ ancho: a === '80' ? 80 : 58 })}
          opciones={[
            { valor: '58', texto: '58 mm (32 columnas)' },
            { valor: '80', texto: '80 mm (48 columnas)' },
          ]}
        />
      </Tarjeta>

      <Tarjeta titulo="Opciones">
        {esEscPos && (
          <>
            <Segmentos
              etiqueta="Densidad (qué tan oscuro imprime)"
              valor={config.densidad}
              alCambiar={(densidad: Densidad) => cambiar({ densidad })}
              opciones={[
                { valor: 'baja', texto: 'Baja' },
                { valor: 'normal', texto: 'Normal' },
                { valor: 'alta', texto: 'Alta' },
              ]}
            />
            <p className="-mt-2 text-etiqueta text-grafito-suave">
              Si la impresión sale igual o con signos raros, déjala en Normal.
            </p>
            <Segmentos
              etiqueta="Líneas de avance al final"
              valor={String(config.avance)}
              alCambiar={(n) => cambiar({ avance: Number(n) })}
              opciones={numeros(0, AVANCE_MAXIMO).map((n) => ({ valor: n, texto: n }))}
            />
            <Interruptor
              etiqueta="Cortar papel al final"
              descripcion="Solo si la impresora tiene cortador (muchas de 58 mm no lo tienen)."
              activo={config.cortar}
              alCambiar={(cortar) => cambiar({ cortar })}
            />
            <Segmentos
              etiqueta="Copias"
              valor={String(config.copias)}
              alCambiar={(n) => cambiar({ copias: Number(n) })}
              opciones={numeros(1, COPIAS_MAXIMAS).map((n) => ({ valor: n, texto: n }))}
            />
          </>
        )}
        <Interruptor
          etiqueta="Imprimir automáticamente al cobrar"
          descripcion="Imprime el ticket en cuanto se confirma cada venta."
          activo={config.imprimirAlCobrar}
          alCambiar={(imprimirAlCobrar) => cambiar({ imprimirAlCobrar })}
        />
      </Tarjeta>

      <div className="flex flex-col gap-2">
        <div>
          <Boton variante="oscuro" tamano="grande" disabled={!configNegocio || imprimiendo} onClick={prueba}>
            <Printer aria-hidden /> {fallo ? 'Reintentar' : 'Imprimir prueba'}
          </Boton>
        </div>
        {fallo && <Mensaje aviso={{ tipo: 'error', mensaje: fallo.mensaje, ayuda: fallo.ayuda }} />}
        {pruebaEnviada && !fallo && (
          <p className="text-cafeto" role="status">
            Prueba enviada a la impresora.
          </p>
        )}
      </div>
    </Pantalla>
  );
}
