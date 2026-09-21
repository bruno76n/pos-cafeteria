import { useState } from 'react';
import { Campo } from '@/componentes/Campo';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import type { ConfigGeneral } from '@/dominio/tipos';
import { useConfigEditable } from '@/estado/config';
import { BotonGuardar } from './Guardar';
import { VistaPreviaTicket } from './VistaPreviaTicket';

const numero = (texto: string) => Number(texto.replace(',', '.'));

function Formulario({
  config,
  guardar,
}: {
  config: ConfigGeneral;
  guardar: (c: ConfigGeneral) => Promise<unknown>;
}) {
  const [ventas, setVentas] = useState(config.ventas);
  const [tasa, setTasa] = useState(String(Math.round(config.ventas.tasaIVA * 10000) / 100));
  const [tope, setTope] = useState(String(config.ventas.descuentoMaximoPorcentaje));
  const cambiar = (cambios: Partial<ConfigGeneral['ventas']>) => setVentas((v) => ({ ...v, ...cambios }));
  const tasaValida = numero(tasa) >= 0 && numero(tasa) <= 100;
  const borrador: ConfigGeneral = {
    ...config,
    ventas: { ...ventas, tasaIVA: tasaValida ? numero(tasa) / 100 : ventas.tasaIVA },
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-4 rounded-hoja border border-linea bg-papel p-5">
        <h2 className="text-seccion font-semibold">Impuestos</h2>
        <Interruptor
          etiqueta="Los precios incluyen IVA"
          descripcion="Si no, el IVA se suma al total de cada venta."
          activo={ventas.preciosIncluyenIVA}
          alCambiar={(preciosIncluyenIVA) => cambiar({ preciosIncluyenIVA })}
        />
        <Campo
          etiqueta="Tasa de IVA (%)"
          inputMode="decimal"
          className="max-w-40"
          value={tasa}
          onChange={(e) => setTasa(e.target.value.replace(/[^\d.,]/g, ''))}
          error={tasaValida ? null : 'Escribe un porcentaje entre 0 y 100.'}
        />
        <Interruptor
          etiqueta="Mostrar desglose de IVA en el ticket"
          activo={ventas.mostrarDesgloseIVA}
          alCambiar={(mostrarDesgloseIVA) => cambiar({ mostrarDesgloseIVA })}
        />
        <h2 className="mt-2 text-seccion font-semibold">Descuentos</h2>
        <Interruptor
          etiqueta="Permitir descuentos"
          activo={ventas.descuentosPermitidos}
          alCambiar={(descuentosPermitidos) => cambiar({ descuentosPermitidos })}
        />
        <Campo
          etiqueta="Descuento máximo (%)"
          inputMode="numeric"
          className="max-w-40"
          disabled={!ventas.descuentosPermitidos}
          value={tope}
          onChange={(e) => setTope(e.target.value.replace(/\D/g, '').slice(0, 3))}
        />
        <BotonGuardar
          alGuardar={async () => {
            if (!tasaValida) return 'Escribe una tasa de IVA entre 0 y 100.';
            const maximo = Number(tope);
            if (!(maximo >= 0 && maximo <= 100)) return 'El descuento máximo va de 0 a 100 %.';
            await guardar({ ...borrador, ventas: { ...borrador.ventas, descuentoMaximoPorcentaje: maximo } });
            return null;
          }}
        />
      </div>
      <VistaPreviaTicket config={borrador} />
    </div>
  );
}

export function ConfigImpuestos() {
  const { config, guardarConfig } = useConfigEditable();
  if (!config) return null;
  return (
    <Pantalla titulo="Impuestos y descuentos">
      <Formulario config={config} guardar={guardarConfig} />
    </Pantalla>
  );
}
