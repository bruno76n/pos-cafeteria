import { useState } from 'react';
import { Boton } from '@/componentes/Boton';
import { Hoja } from '@/componentes/Hoja';
import { useCategorias, useGruposModificadores, useProductos, useTurnoAbierto } from '@/datos/consultas';
import { crearLinea } from '@/dominio/carrito';
import { gruposDelProducto } from '@/dominio/modificadores';
import type { Producto } from '@/dominio/tipos';
import { useCarrito } from '@/estado/carrito';
import { useDispositivoActual } from '@/estado/dispositivo';
import { FormularioAbrirCaja } from '@/pantallas/caja/FormularioAbrirCaja';
import { Catalogo } from './Catalogo';
import { HojaPersonalizacion } from './HojaPersonalizacion';

export function NuevaVenta() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const categorias = useCategorias();
  const productos = useProductos();
  const grupos = useGruposModificadores();
  const agregar = useCarrito((s) => s.agregar);
  const [abriendo, setAbriendo] = useState(false);
  const [personalizando, setPersonalizando] = useState<Producto | null>(null);

  if (turno === undefined || !categorias || !productos || !grupos) return null;

  if (!turno) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-seccion font-semibold">Abre la caja para empezar a vender.</p>
        <Boton variante="oscuro" tamano="grande" onClick={() => setAbriendo(true)}>
          Abrir caja
        </Boton>
        {abriendo && (
          <Hoja titulo="Abrir caja" centrada ancho="max-w-md" alCerrar={() => setAbriendo(false)}>
            <FormularioAbrirCaja alAbrir={() => setAbriendo(false)} />
          </Hoja>
        )}
      </div>
    );
  }

  function tocarProducto(producto: Producto) {
    if (gruposDelProducto(producto, grupos!).length > 0) return setPersonalizando(producto);
    const categoria = categorias!.find((c) => c.id === producto.categoriaId);
    agregar(crearLinea({ producto, categoria, grupos: grupos! }));
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Catalogo categorias={categorias} productos={productos} alTocarProducto={tocarProducto} />
      {personalizando && (
        <HojaPersonalizacion
          producto={personalizando}
          categoria={categorias.find((c) => c.id === personalizando.categoriaId)}
          grupos={grupos}
          alTerminar={(linea) => {
            agregar(linea);
            setPersonalizando(null);
          }}
          alCerrar={() => setPersonalizando(null)}
        />
      )}
    </div>
  );
}
