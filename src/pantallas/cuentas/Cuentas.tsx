import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Boton } from '@/componentes/Boton';
import { Pantalla } from '@/componentes/Pantalla';
import { useConfig, useCuentasAbiertasConLineas, useTurnoAbierto } from '@/datos/consultas';
import { calcularTotales } from '@/dominio/carrito';
import { formatearDinero } from '@/dominio/dinero';
import { formatearHora } from '@/dominio/fechas';
import { useCarrito } from '@/estado/carrito';
import { useDispositivoActual } from '@/estado/dispositivo';
import { DialogoNuevaCuenta } from './DialogoNuevaCuenta';

/** Cuentas abiertas de todas las cajas: una tarjeta por cuenta; tocarla la abre en Nueva venta. */
export function Cuentas() {
  const navegar = useNavigate();
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const config = useConfig();
  const cuentas = useCuentasAbiertasConLineas();
  const [abriendo, setAbriendo] = useState(false);
  if (!config || !cuentas || turno === undefined) return null;

  const abrir = (cuentaId: string | null) => {
    useCarrito.getState().activarCuenta(cuentaId);
    void navegar('/venta');
  };
  const variasCajas = new Set(cuentas.map((c) => c.cuenta.dispositivoId)).size > 1;

  return (
    <Pantalla
      titulo={cuentas.length > 0 ? `Cuentas abiertas (${cuentas.length})` : 'Cuentas abiertas'}
      acciones={
        <Boton variante="oscuro" tamano="grande" disabled={!turno} onClick={() => setAbriendo(true)}>
          <Plus aria-hidden /> Nueva cuenta
        </Boton>
      }
    >
      {!turno && <p className="text-grafito-suave">Abre la caja para abrir cuentas y cobrarlas.</p>}
      {cuentas.length === 0 ? (
        <p className="p-8 text-center text-grafito-suave">No hay cuentas abiertas.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {cuentas.map(({ cuenta, lineas, comandas }) => (
            <li key={cuenta.id}>
              <button
                type="button"
                onClick={() => abrir(cuenta.id)}
                className="flex min-h-40 w-full flex-col items-start gap-1 rounded-hoja border border-linea bg-papel p-4 text-left active:bg-acero"
              >
                <span className="text-pantalla leading-none font-bold">Cuenta {cuenta.numero}</span>
                <span className={cuenta.nombre ? 'text-producto font-semibold' : 'text-grafito-suave'}>
                  {cuenta.nombre ?? 'Sin nombre'}
                </span>
                <span className="text-etiqueta text-grafito-suave">
                  {comandas === 1 ? '1 comanda' : `${comandas} comandas`} ·{' '}
                  {formatearHora(cuenta.fecha, config.zonaHoraria)}
                  {variasCajas && ` · ${cuenta.dispositivoNombre}`}
                </span>
                <span className="cifras mt-auto self-end text-seccion font-bold">
                  {formatearDinero(calcularTotales(lineas, null, config.ventas).total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {abriendo && turno && dispositivo && (
        <DialogoNuevaCuenta
          turno={turno}
          dispositivo={dispositivo}
          alCerrar={() => setAbriendo(false)}
          alAbrir={(cuenta) => abrir(cuenta.id)}
        />
      )}
    </Pantalla>
  );
}
