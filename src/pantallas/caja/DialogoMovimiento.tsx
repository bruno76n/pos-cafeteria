import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Hoja } from '@/componentes/Hoja';
import { Segmentos } from '@/componentes/Segmentos';
import { useConfig } from '@/datos/consultas';
import { registrarMovimiento } from '@/datos/escrituras';
import type { Movimiento, Turno } from '@/dominio/tipos';
import { useAutorizar } from '@/estado/autorizacion';

const TITULOS: Record<Movimiento['tipo'], string> = {
  entrada: 'Registrar entrada',
  retiro: 'Registrar retiro',
  gasto: 'Registrar gasto',
};

const EJEMPLOS: Record<Movimiento['tipo'], string> = {
  entrada: 'Cambio para caja, fondo adicional…',
  retiro: 'El dueño se lleva efectivo…',
  gasto: 'Bolsa de hielo, leche…',
};

/** Entrada, retiro o gasto (con categoría). Requiere registrarGastos o autorización. */
export function DialogoMovimiento({
  turno,
  tipo,
  alCerrar,
}: {
  turno: Turno;
  tipo: Movimiento['tipo'];
  alCerrar: () => void;
}) {
  const config = useConfig();
  const autorizar = useAutorizar();
  const categorias = config?.gastos.categorias ?? [];
  const [categoria, setCategoria] = useState(categorias[0] ?? '');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!monto) return setError('Escribe el monto.');
    if (tipo === 'gasto' && !concepto.trim()) return setError('Escribe el concepto del gasto.');
    const permitido = await autorizar('registrarGastos');
    if (!permitido) return;
    await registrarMovimiento({
      turno,
      tipo,
      categoria: tipo === 'gasto' ? categoria || null : null,
      concepto,
      monto,
      usuario: permitido.usuario,
    });
    alCerrar();
  }

  return (
    <Hoja
      titulo={TITULOS[tipo]}
      centrada
      ancho="max-w-lg"
      alCerrar={alCerrar}
      pie={
        <div className="flex justify-end">
          <Boton variante="oscuro" tamano="grande" onClick={guardar}>
            {TITULOS[tipo]}
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {tipo === 'gasto' && categorias.length > 0 && (
          <Segmentos
            etiqueta="Categoría"
            valor={categoria}
            alCambiar={setCategoria}
            opciones={categorias.map((c) => ({ valor: c, texto: c }))}
          />
        )}
        <Campo
          etiqueta={tipo === 'gasto' ? 'Concepto' : 'Concepto (opcional)'}
          placeholder={EJEMPLOS[tipo]}
          value={concepto}
          maxLength={80}
          onChange={(e) => setConcepto(e.target.value)}
        />
        <CampoDinero etiqueta="Monto" valor={monto} alCambiar={setMonto} />
        {error && (
          <p className="text-faltante" role="alert">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  );
}
