import { RouterProvider } from 'react-router/dom';
import { AvisoActualizacion } from '@/componentes/AvisoActualizacion';
import { useTema } from '@/estado/tema';
import { router } from '@/rutas';

export function App() {
  useTema();
  return (
    <>
      <RouterProvider router={router} />
      <AvisoActualizacion />
    </>
  );
}
