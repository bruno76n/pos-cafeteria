import { documentoImpresion } from '../html';
import type { TicketDocumento } from '../ticket';
import type { DriverImpresora } from './tipos';

/** window.print() sobre un iframe oculto: funciona en todos lados (en iPad, AirPrint o PDF). */
export const driverNavegador: DriverImpresora = {
  tipo: 'navegador',
  nombre: 'Diálogo del sistema',
  soportado: () => typeof window !== 'undefined' && typeof window.print === 'function',
  conectar: async () => null,
  reconectar: async () => true,
  estado: () => 'conectada',
  imprimir: (doc: TicketDocumento) =>
    new Promise<void>((resolver) => {
      const marco = document.createElement('iframe');
      marco.setAttribute('aria-hidden', 'true');
      marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      marco.srcdoc = documentoImpresion(doc);
      marco.onload = () => {
        const ventana = marco.contentWindow;
        const terminar = () => {
          marco.remove();
          resolver();
        };
        if (!ventana) return terminar();
        ventana.addEventListener('afterprint', terminar, { once: true });
        ventana.focus();
        ventana.print();
        // Algunos navegadores no disparan afterprint: se limpia de todos modos.
        setTimeout(terminar, 60_000);
      };
      document.body.appendChild(marco);
    }),
};
