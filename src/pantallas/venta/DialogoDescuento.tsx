import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Hoja } from '@/componentes/Hoja';
import { Segmentos } from '@/componentes/Segmentos';
import {
  importeDescuento,
  validarDescuento,
  type ConfigVentas,
  type DescuentoCarrito,
} from '@/dominio/carrito';
import { formatearDinero } from '@/dominio/dinero';
import { useAutorizar } from '@/estado/autorizacion';
import { useCarrito } from '@/estado/carrito';

const RAPIDOS = [5, 10, 15, 20];

/** Descuento a toda la venta (porcentaje o monto), con tope y permiso o autorización. */
export function DialogoDescuento({
  subtotal,
  config,
  alCerrar,
}: {
  subtotal: number;
  config: ConfigVentas;
  alCerrar: () => void;
}) {
  const actual = useCarrito((s) => s.carrito.descuento);
  const ponerDescuento = useCarrito((s) => s.ponerDescuento);
  const autorizar = useAutorizar();
  const [tipo, setTipo] = useState<DescuentoCarrito['tipo']>(actual?.tipo ?? 'porcentaje');
  const [porcentaje, setPorcentaje] = useState(actual?.tipo === 'porcentaje' ? String(actual.valor) : '');
  const [monto, setMonto] = useState<number | null>(actual?.tipo === 'monto' ? actual.valor : null);
  const [motivo, setMotivo] = useState(actual?.motivo ?? '');
  const [error, setError] = useState<string | null>(null);

  const valor = tipo === 'porcentaje' ? Number(porcentaje.replace(',', '.')) || 0 : (monto ?? 0);
  const propuesto: DescuentoCarrito = { tipo, valor, motivo: motivo.trim() || null, autorizadoPor: null };
  const importe = importeDescuento(subtotal, propuesto);

  async function aplicar() {
    const problema = validarDescuento(propuesto, subtotal, config);
    if (problema) return setError(problema);
    const permitido = await autorizar('aplicarDescuentos');
    if (!permitido) return;
    ponerDescuento({ ...propuesto, autorizadoPor: permitido.autorizadoPor });
    alCerrar();
  }

  return (
    <Hoja
      titulo="Descuento"
      centrada
      ancho="max-w-lg"
      alCerrar={alCerrar}
      pie={
        <div className="flex flex-wrap justify-end gap-2">
          {actual && (
            <Boton
              variante="peligro"
              tamano="grande"
              className="mr-auto"
              onClick={() => {
                ponerDescuento(null);
                alCerrar();
              }}
            >
              Quitar descuento
            </Boton>
          )}
          <Boton variante="oscuro" tamano="grande" onClick={aplicar} disabled={valor <= 0}>
            Aplicar <span className="cifras">−{formatearDinero(importe)}</span>
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmentos
          etiqueta="Tipo"
          valor={tipo}
          alCambiar={(t) => {
            setTipo(t);
            setError(null);
          }}
          opciones={[
            { valor: 'porcentaje', texto: 'Porcentaje' },
            { valor: 'monto', texto: 'Monto' },
          ]}
        />
        {tipo === 'porcentaje' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {RAPIDOS.filter((p) => p <= config.descuentoMaximoPorcentaje).map((p) => (
                <Boton
                  key={p}
                  tamano="grande"
                  aria-pressed={valor === p}
                  onClick={() => setPorcentaje(String(p))}
                >
                  {p}%
                </Boton>
              ))}
            </div>
            <Campo
              etiqueta="Porcentaje"
              inputMode="decimal"
              className="cifras"
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value.replace(/[^\d.,]/g, ''));
                setError(null);
              }}
              ayuda={`Máximo ${config.descuentoMaximoPorcentaje}%.`}
            />
          </>
        ) : (
          <CampoDinero
            etiqueta="Monto"
            valor={monto}
            alCambiar={(m) => {
              setMonto(m);
              setError(null);
            }}
          />
        )}
        <Campo
          etiqueta="Motivo (opcional)"
          value={motivo}
          maxLength={80}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  );
}
