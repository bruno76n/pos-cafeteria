import { Plus, Trash } from 'lucide-react';
import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import type { ConfigGeneral, CuentaBancaria } from '@/dominio/tipos';
import { useConfigEditable } from '@/estado/config';
import { BotonGuardar } from './Guardar';

const cuentaNueva = (): CuentaBancaria => ({
  id: crypto.randomUUID(),
  banco: '',
  titular: '',
  clabe: '',
  cuenta: '',
  alias: '',
});

function Formulario({
  config,
  guardar,
}: {
  config: ConfigGeneral;
  guardar: (c: ConfigGeneral) => Promise<unknown>;
}) {
  const [pagos, setPagos] = useState(config.pagos);
  const cambiar = (cambios: Partial<ConfigGeneral['pagos']>) => setPagos((p) => ({ ...p, ...cambios }));
  const cambiarCuenta = (id: string, cambios: Partial<CuentaBancaria>) =>
    cambiar({ cuentas: pagos.cuentas.map((c) => (c.id === id ? { ...c, ...cambios } : c)) });

  return (
    <div className="flex max-w-3xl flex-col gap-4 rounded-hoja border border-linea bg-papel p-5">
      <p className="text-grafito-suave">El efectivo siempre está activo.</p>
      <Interruptor
        etiqueta="Tarjeta"
        descripcion="Cobro en terminal externa."
        activo={pagos.tarjeta}
        alCambiar={(tarjeta) => cambiar({ tarjeta })}
      />
      <Interruptor
        etiqueta="Transferencia"
        activo={pagos.transferencia}
        alCambiar={(transferencia) => cambiar({ transferencia })}
      />
      {pagos.transferencia && (
        <>
          <Interruptor
            etiqueta="Referencia de transferencia obligatoria"
            activo={pagos.referenciaTransferenciaObligatoria}
            alCambiar={(referenciaTransferenciaObligatoria) =>
              cambiar({ referenciaTransferenciaObligatoria })
            }
          />
          <h2 className="mt-2 text-seccion font-semibold">Cuentas para transferencia</h2>
          {pagos.cuentas.map((c, i) => (
            <fieldset key={c.id} className="grid gap-3 rounded-boton border border-linea p-4 sm:grid-cols-2">
              <legend className="px-1 font-semibold">Cuenta {i + 1}</legend>
              <Campo
                etiqueta="Alias"
                placeholder="Principal"
                value={c.alias}
                onChange={(e) => cambiarCuenta(c.id, { alias: e.target.value })}
              />
              <Campo
                etiqueta="Banco"
                value={c.banco}
                onChange={(e) => cambiarCuenta(c.id, { banco: e.target.value })}
              />
              <Campo
                etiqueta="Titular"
                value={c.titular}
                onChange={(e) => cambiarCuenta(c.id, { titular: e.target.value })}
              />
              <Campo
                etiqueta="CLABE"
                inputMode="numeric"
                value={c.clabe}
                onChange={(e) =>
                  cambiarCuenta(c.id, { clabe: e.target.value.replace(/\D/g, '').slice(0, 18) })
                }
              />
              <Campo
                etiqueta="Cuenta o tarjeta"
                inputMode="numeric"
                value={c.cuenta}
                onChange={(e) =>
                  cambiarCuenta(c.id, { cuenta: e.target.value.replace(/\D/g, '').slice(0, 20) })
                }
              />
              <div className="flex items-end justify-end">
                <Boton
                  variante="peligro"
                  onClick={() => cambiar({ cuentas: pagos.cuentas.filter((x) => x.id !== c.id) })}
                >
                  <Trash aria-hidden size={18} /> Quitar cuenta
                </Boton>
              </div>
            </fieldset>
          ))}
          <Boton
            className="self-start"
            onClick={() => cambiar({ cuentas: [...pagos.cuentas, cuentaNueva()] })}
          >
            <Plus aria-hidden /> Agregar cuenta
          </Boton>
        </>
      )}
      <BotonGuardar
        alGuardar={async () => {
          const incompleta = pagos.cuentas.find(
            (c) => !c.banco.trim() || !c.titular.trim() || (!c.clabe && !c.cuenta),
          );
          if (incompleta) return 'Cada cuenta necesita banco, titular y CLABE o número de cuenta.';
          if (pagos.cuentas.some((c) => c.clabe && c.clabe.length !== 18))
            return 'La CLABE tiene 18 dígitos.';
          await guardar({ ...config, pagos });
          return null;
        }}
      />
    </div>
  );
}

export function ConfigPagos() {
  const { config, guardarConfig } = useConfigEditable();
  if (!config) return null;
  return (
    <Pantalla titulo="Pagos">
      <Formulario config={config} guardar={guardarConfig} />
    </Pantalla>
  );
}
