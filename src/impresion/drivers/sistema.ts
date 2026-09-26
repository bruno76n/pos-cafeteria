import { documentoImpresion } from '../html';
import type { TicketDocumento } from '../ticket';
import { sinConexion, type DriverImpresora } from './tipos';

/**
 * Diálogo de impresión del navegador sobre un iframe oculto: funciona en todos lados (en iPad,
 * AirPrint o PDF). Las copias se eligen en el diálogo; densidad, avance y corte los pone el sistema.
 */
export const driverSistema: DriverImpresora = {
  ...sinConexion,
  tipo: 'sistema',
  nombre: 'Sistema',
  soportado: () => typeof window !== 'undefined' && typeof window.print === 'function',
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
