import { useState } from 'react';
import { Boton } from '@/componentes/Boton';

/** "Guardar cambios" con aviso de guardado y error de validación. */
export function BotonGuardar({ alGuardar }: { alGuardar: () => Promise<string | null> }) {
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {estado && (
        <p
          role={estado.tipo === 'error' ? 'alert' : 'status'}
          className={estado.tipo === 'error' ? 'text-faltante' : 'text-cafeto'}
        >
          {estado.texto}
        </p>
      )}
      <Boton
        variante="oscuro"
        tamano="grande"
        onClick={async () => {
          const error = await alGuardar();
          setEstado(error ? { tipo: 'error', texto: error } : { tipo: 'ok', texto: 'Cambios guardados.' });
        }}
      >
        Guardar cambios
      </Boton>
    </div>
  );
}
