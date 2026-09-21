import { RouterProvider } from 'react-router/dom';
import { AvisoActualizacion } from '@/componentes/AvisoActualizacion';
import { router } from '@/rutas';

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <AvisoActualizacion />
    </>
  );
}
