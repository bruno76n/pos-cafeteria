import { RouterProvider } from 'react-router/dom';
import { router } from '@/rutas';

export function App() {
  return <RouterProvider router={router} />;
}
