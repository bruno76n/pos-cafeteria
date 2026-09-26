import { useState } from 'react';
import { Campo } from '@/componentes/Campo';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import type { ConfigGeneral } from '@/dominio/tipos';
import { useConfigEditable } from '@/estado/config';
import { opcionesComanda, type OpcionesComanda } from '@/impresion/comanda';
import { BotonGuardar } from './Guardar';
import { VistaPreviaTicket } from './VistaPreviaTicket';

type OpcionesTicket = ConfigGeneral['ticket'];

const CAMPOS: { clave: keyof OpcionesTicket & `mostrar${string}`; texto: string }[] = [
  { clave: 'mostrarLogo', texto: 'Mostrar logo' },
  { clave: 'mostrarDireccion', texto: 'Mostrar dirección' },
  { clave: 'mostrarTelefono', texto: 'Mostrar teléfono' },
  { clave: 'mostrarRFC', texto: 'Mostrar RFC' },
  { clave: 'mostrarCajero', texto: 'Mostrar cajero' },
];

function Formulario({
  config,
  guardar,
}: {
  config: ConfigGeneral;
  guardar: (c: ConfigGeneral) => Promise<unknown>;
}) {
  const [ticket, setTicket] = useState(config.ticket);
  const cambiar = (cambios: Partial<OpcionesTicket>) => setTicket((t) => ({ ...t, ...cambios }));
  const borrador: ConfigGeneral = { ...config, ticket };
  const comanda = opcionesComanda(ticket);
  const cambiarComanda = (cambios: Partial<OpcionesComanda>) =>
    cambiar({ comanda: { ...comanda, ...cambios } });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-5">
        {CAMPOS.map((c) => (
          <Interruptor
            key={c.clave}
            etiqueta={c.texto}
            activo={ticket[c.clave] ?? false}
            alCambiar={(v) => cambiar({ [c.clave]: v })}
          />
        ))}
        <Campo
          etiqueta="Mensaje final"
          value={ticket.mensajeFinal}
          maxLength={80}
          onChange={(e) => cambiar({ mensajeFinal: e.target.value })}
        />
        <Interruptor
          etiqueta="QR con el ticket digital"
          descripcion="El cliente lo escanea y ve su ticket en el celular."
          activo={ticket.mostrarQR ?? false}
          alCambiar={(mostrarQR) => cambiar({ mostrarQR })}
        />
        <h2 className="mt-2 text-seccion font-semibold">Comanda de cocina</h2>
        <Interruptor
          etiqueta="Imprimir comanda de cocina"
          descripcion="Al cobrar sale también una comanda sin precios con lo que hay que preparar."
          activo={comanda.imprimir}
          alCambiar={(imprimir) => cambiarComanda({ imprimir })}
        />
        {comanda.imprimir && (
          <>
            <Segmentos
              etiqueta="Orden de impresión"
              valor={comanda.orden}
              alCambiar={(orden) => cambiarComanda({ orden })}
              opciones={[
                { valor: 'cocina', texto: 'Cocina primero' },
                { valor: 'cliente', texto: 'Cliente primero' },
              ]}
            />
            <Segmentos
              etiqueta="Copias de la comanda"
              valor={String(comanda.copias) as '1' | '2' | '3'}
              alCambiar={(n) => cambiarComanda({ copias: Number(n) })}
              opciones={(['1', '2', '3'] as const).map((n) => ({ valor: n, texto: n }))}
            />
          </>
        )}
        <p className="text-etiqueta text-grafito-suave">
          El ancho del papel y la impresión al cobrar se eligen en cada tablet, en Configuración › Impresora.
        </p>
        <BotonGuardar
          alGuardar={async () => {
            await guardar(borrador);
            return null;
          }}
        />
      </div>
      <VistaPreviaTicket config={borrador} conComanda />
    </div>
  );
}

export function ConfigTicket() {
  const { config, guardarConfig } = useConfigEditable();
  if (!config) return null;
  return (
    <Pantalla titulo="Ticket">
      <Formulario config={config} guardar={guardarConfig} />
    </Pantalla>
  );
}
