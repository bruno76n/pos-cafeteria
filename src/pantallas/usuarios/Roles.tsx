import { Check } from 'lucide-react';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { useConfigEditable } from '@/estado/config';
import { NOMBRE_PERMISO, PERMISOS } from '@/dominio/permisos';
import type { Permiso } from '@/dominio/tipos';

/** Matriz de permisos: el Administrador tiene todo (no se edita); Encargado y Cajero, editables. */
export function Roles() {
  const { config, guardarConfig } = useConfigEditable();
  if (!config) return null;

  const cambiar = (rol: 'encargado' | 'cajero', permiso: Permiso, activo: boolean) =>
    guardarConfig({
      ...config,
      roles: { ...config.roles, [rol]: { ...config.roles[rol], [permiso]: activo } },
    });

  return (
    <Pantalla titulo="Roles y permisos">
      <p className="text-grafito-suave">Los cambios se aplican de inmediato en todas las tablets.</p>
      <div className="overflow-x-auto rounded-hoja bg-papel">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-linea text-left text-etiqueta text-grafito-suave">
              <th className="px-4 py-3 font-normal">Permiso</th>
              <th className="px-4 py-3 text-center font-normal">Administrador</th>
              <th className="px-4 py-3 text-center font-normal">Encargado</th>
              <th className="px-4 py-3 text-center font-normal">Cajero</th>
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map((p) => (
              <tr key={p} className="border-b border-linea last:border-b-0">
                <td className="px-4 py-2">{NOMBRE_PERMISO[p]}</td>
                <td className="px-4 py-2">
                  <Check aria-label="Siempre" className="mx-auto text-grafito-suave" />
                </td>
                {(['encargado', 'cajero'] as const).map((rol) => (
                  <td key={rol} className="px-4 py-2">
                    <span className="flex justify-center">
                      <Interruptor
                        soloInterruptor
                        etiqueta={`${NOMBRE_PERMISO[p]} (${rol === 'encargado' ? 'Encargado' : 'Cajero'})`}
                        activo={config.roles[rol][p]}
                        alCambiar={(activo) => void cambiar(rol, p, activo)}
                      />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-4 py-2">Usuarios y Configuración</td>
              <td className="px-4 py-2">
                <Check aria-label="Siempre" className="mx-auto text-grafito-suave" />
              </td>
              <td className="px-4 py-2 text-center text-grafito-suave">—</td>
              <td className="px-4 py-2 text-center text-grafito-suave">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Pantalla>
  );
}
