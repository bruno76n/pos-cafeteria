import { useState } from 'react';
import { Campo } from '@/componentes/Campo';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import type { ConfigGeneral } from '@/dominio/tipos';
import { useConfigEditable } from '@/estado/config';
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-5">
        <Segmentos
          etiqueta="Ancho del papel"
          valor={String(ticket.ancho) as '58' | '80'}
          alCambiar={(ancho) => cambiar({ ancho: ancho === '80' ? 80 : 58 })}
          opciones={[
            { valor: '58', texto: '58 mm' },
            { valor: '80', texto: '80 mm' },
          ]}
        />
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
        <Interruptor
          etiqueta="Imprimir al cobrar"
          descripcion="Imprime el ticket en cuanto se confirma cada venta."
          activo={ticket.imprimirAlCobrar}
          alCambiar={(imprimirAlCobrar) => cambiar({ imprimirAlCobrar })}
        />
        <BotonGuardar
          alGuardar={async () => {
            await guardar(borrador);
            return null;
          }}
        />
      </div>
      <VistaPreviaTicket config={borrador} />
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
