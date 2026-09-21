import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Boton } from './Boton';
import { Hoja } from './Hoja';

/**
 * Comparte el texto del ticket con la hoja de compartir del sistema; si no existe,
 * ofrece copiarlo o abrir WhatsApp con el texto.
 */
export function BotonCompartir({
  titulo,
  texto,
  className = '',
}: {
  titulo: string;
  texto: string;
  className?: string;
}) {
  const [opciones, setOpciones] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function compartir() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: titulo, text: texto });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    setAviso(null);
    setOpciones(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Ticket copiado. Pégalo en el chat del cliente.');
    } catch {
      setAviso('No se pudo copiar. Usa WhatsApp.');
    }
  }

  return (
    <>
      <Boton tamano="grande" className={className} onClick={compartir}>
        <Share2 aria-hidden /> Compartir
      </Boton>
      {opciones && (
        <Hoja titulo="Compartir ticket" centrada ancho="max-w-md" alCerrar={() => setOpciones(false)}>
          <div className="flex flex-col gap-3">
            <Boton tamano="grande" onClick={copiar}>
              <Copy aria-hidden /> Copiar texto
            </Boton>
            <a
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-boton border border-linea bg-papel px-5 text-producto font-semibold active:bg-acero"
              href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle aria-hidden /> Abrir WhatsApp
            </a>
            {aviso && <p role="status">{aviso}</p>}
          </div>
        </Hoja>
      )}
    </>
  );
}
