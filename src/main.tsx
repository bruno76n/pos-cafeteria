import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/estilos/global.css';
import { solicitarAlmacenamientoPersistente } from '@/datos/almacenamiento';
import { useCarrito } from '@/estado/carrito';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root');

void useCarrito.getState().cargar();
void solicitarAlmacenamientoPersistente();

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
