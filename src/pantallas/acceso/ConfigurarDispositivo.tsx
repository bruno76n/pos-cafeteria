import { FormularioDispositivo } from './FormularioDispositivo';

/** Primera vez en esta tablet: nombre, tipo y prefijo de folio. */
export function ConfigurarDispositivo() {
  return (
    <main className="flex h-full justify-center overflow-y-auto p-4">
      <div className="flex w-full max-w-2xl flex-col gap-4 self-start rounded-hoja bg-papel p-6">
        <h1 className="text-pantalla font-bold">Configura este dispositivo</h1>
        <p className="text-grafito-suave">Así sabremos qué caja registró cada venta.</p>
        <FormularioDispositivo actual={null} textoGuardar="Guardar y continuar" />
      </div>
    </main>
  );
}
