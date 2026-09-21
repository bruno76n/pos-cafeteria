import { Check, Delete } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ESPERA_PIN_MS, INTENTOS_PIN } from '@/dominio/pin';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'entrar', '0', 'borrar'] as const;
const clasesTecla =
  'flex size-18 items-center justify-center rounded-boton bg-papel text-pantalla font-semibold border border-linea active:scale-[0.98] active:bg-acero disabled:opacity-40';

/**
 * Teclado de PIN propio. Prueba el PIN al llegar a 4, 5 y 6 dígitos (el PIN identifica al
 * usuario); "Entrar" o el sexto dígito sin coincidencia cuentan como intento fallido.
 * Tras 5 fallos, espera de 30 segundos. Si `verificar` regresa un texto, el PIN existe pero se
 * rechaza (p. ej. el usuario no tiene el permiso): se muestra el texto sin contar como fallo.
 */
export function TecladoPin({ verificar }: { verificar: (pin: string) => Promise<boolean | string> }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fallos, setFallos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [ocupado, setOcupado] = useState(false);

  const segundos = Math.ceil((bloqueadoHasta - ahora) / 1000);
  const bloqueado = segundos > 0;

  useEffect(() => {
    if (!bloqueadoHasta) return;
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [bloqueadoHasta]);

  const fallar = useCallback(() => {
    const n = fallos + 1;
    setPin('');
    if (n >= INTENTOS_PIN) {
      setFallos(0);
      setAhora(Date.now());
      setBloqueadoHasta(Date.now() + ESPERA_PIN_MS);
      setError(null);
    } else {
      setFallos(n);
      setError('PIN incorrecto.');
    }
  }, [fallos]);

  const probar = useCallback(
    async (candidato: string, definitivo: boolean) => {
      setOcupado(true);
      const ok = candidato.length >= 4 && (await verificar(candidato));
      setOcupado(false);
      if (typeof ok === 'string') {
        setPin('');
        setError(ok);
      } else if (ok) {
        setPin('');
        setFallos(0);
        setError(null);
      } else if (definitivo) {
        fallar();
      }
    },
    [verificar, fallar],
  );

  const tocar = useCallback(
    (tecla: (typeof TECLAS)[number]) => {
      if (bloqueado || ocupado) return;
      if (tecla === 'borrar') return setPin((p) => p.slice(0, -1));
      if (tecla === 'entrar') return void probar(pin, true);
      if (pin.length >= 6) return;
      const nuevo = pin + tecla;
      setPin(nuevo);
      setError(null);
      if (nuevo.length >= 4) void probar(nuevo, nuevo.length === 6);
    },
    [bloqueado, ocupado, pin, probar],
  );

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tocar(e.key as (typeof TECLAS)[number]);
      else if (e.key === 'Backspace') tocar('borrar');
      else if (e.key === 'Enter') tocar('entrar');
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [tocar]);

  const puntos = Math.max(4, pin.length);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex h-6 items-center gap-4" aria-label={`${pin.length} dígitos escritos`}>
        {Array.from({ length: puntos }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 border-grafito ${i < pin.length ? 'bg-grafito' : 'bg-transparent'}`}
          />
        ))}
      </div>
      <p className="min-h-6 text-faltante" role="alert">
        {bloqueado ? `Espera ${segundos} segundos para intentar de nuevo.` : error}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {TECLAS.map((t) =>
          t === 'borrar' ? (
            <button
              key={t}
              type="button"
              aria-label="Borrar"
              className={clasesTecla}
              onClick={() => tocar(t)}
              disabled={bloqueado}
            >
              <Delete aria-hidden />
            </button>
          ) : t === 'entrar' ? (
            <button
              key={t}
              type="button"
              aria-label="Entrar"
              className={clasesTecla}
              onClick={() => tocar(t)}
              disabled={bloqueado || pin.length < 4}
            >
              <Check aria-hidden />
            </button>
          ) : (
            <button
              key={t}
              type="button"
              className={clasesTecla}
              onClick={() => tocar(t)}
              disabled={bloqueado}
            >
              {t}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
