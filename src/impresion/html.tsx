import { renderSVG } from 'uqr';
import { renglonesDe, type TicketDocumento } from './ticket';

// Renderizador HTML: vista previa en pantalla e impresión por el navegador (58 u 80 mm).

const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Estilos del ticket: monoespaciado, `columnas` caracteres de ancho. */
export function estilosTicket(doc: TicketDocumento, selector = '.ticket') {
  return `
${selector} { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; width: ${doc.columnas}ch;
  line-height: 1.25; color: #000; background: #fff; }
${selector} .r { white-space: pre; min-height: 1.25em; }
${selector} .n { font-weight: 700; }
${selector} .d { font-size: 2em; line-height: 1.15; font-weight: 700; }
${selector} .logo { display: block; max-width: 60%; margin: 0 auto 0.5em; filter: grayscale(1) contrast(1.4); }
${selector} .qr svg { display: block; width: 50%; height: auto; margin: 0.5em auto; }`;
}

/** Cuerpo del ticket en HTML. */
export function ticketAHTML(doc: TicketDocumento): string {
  return doc.lineas
    .map((linea) => {
      if (linea.tipo === 'logo') return `<img class="logo" src="${escapar(linea.dataUrl)}" alt="">`;
      if (linea.tipo === 'qr') return `<div class="qr">${renderSVG(linea.contenido, { border: 1 })}</div>`;
      if (linea.tipo === 'corte') return '';
      return renglonesDe(linea, doc.columnas)
        .map((r) => {
          const clases = ['r', r.negrita ? 'n' : '', r.doble ? 'd' : ''].filter(Boolean).join(' ');
          return `<div class="${clases}">${escapar(r.texto)}</div>`;
        })
        .join('');
    })
    .join('');
}

/** Documento completo para imprimir con el diálogo del sistema (@page de 58 u 80 mm). */
export function documentoImpresion(doc: TicketDocumento): string {
  const papel = doc.columnas === 48 ? 80 : 58;
  // El área imprimible es ~4 mm menor que el papel por lado; el tamaño de letra hace caber las columnas.
  const tamano = ((papel - 8) / doc.columnas / 0.6).toFixed(2);
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Ticket</title><style>
@page { size: ${papel}mm auto; margin: 0; }
html, body { margin: 0; padding: 0; }
body { padding: 3mm 4mm; font-size: ${tamano}mm; }
${estilosTicket(doc)}
</style></head><body><div class="ticket">${ticketAHTML(doc)}</div></body></html>`;
}

/** Vista previa del ticket en pantalla. */
export function VistaTicket({ doc, className = '' }: { doc: TicketDocumento; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-boton border border-linea bg-white p-4 shadow-sm ${className}`}>
      <style>{estilosTicket(doc, '.vista-ticket')}</style>
      <div
        className="vista-ticket mx-auto text-[13px]"
        role="document"
        aria-label="Vista previa del ticket"
        dangerouslySetInnerHTML={{ __html: ticketAHTML(doc) }}
      />
    </div>
  );
}
