import { Pantalla } from '@/componentes/Pantalla';
import { useTurnoAbierto } from '@/datos/consultas';
import { formatearHora } from '@/dominio/fechas';
import { useDispositivoActual } from '@/estado/dispositivo';
import { FormularioAbrirCaja } from './FormularioAbrirCaja';

export function CajaActual() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  if (turno === undefined) return null;

  if (!turno) {
    return (
      <Pantalla titulo="Caja actual">
        <div className="flex flex-col gap-4 rounded-hoja bg-papel p-6">
          <h2 className="text-seccion font-semibold">La caja está cerrada</h2>
          <FormularioAbrirCaja />
        </div>
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Caja actual">
      <p className="text-producto">
        Abierta por {turno.abiertoPor.nombre} desde las {formatearHora(turno.abiertoEn)}
      </p>
    </Pantalla>
  );
}
