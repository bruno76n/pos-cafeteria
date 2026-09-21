import { useState } from 'react';
import { Link } from 'react-router';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { Hoja } from '@/componentes/Hoja';
import {
  useCategorias,
  useConfig,
  useGruposModificadores,
  useProductos,
  useTurnoAbierto,
} from '@/datos/consultas';
import { cargarMenuDeEjemplo, registrarVenta } from '@/datos/escrituras';
import { calcularTotales, cantidadDeProductos, crearLinea, type LineaCarrito } from '@/dominio/carrito';
import { armarVenta } from '@/dominio/cobro';
import { formatearDinero } from '@/dominio/dinero';
import { ahoraISO, diaLocal } from '@/dominio/fechas';
import { gruposDelProducto } from '@/dominio/modificadores';
import type { Pago, Producto } from '@/dominio/tipos';
import { useCarrito } from '@/estado/carrito';
import { useDispositivoActual } from '@/estado/dispositivo';
import { refUsuario, useUsuarioActivo } from '@/estado/sesion';
import { FormularioAbrirCaja } from '@/pantallas/caja/FormularioAbrirCaja';
import { CapaCobro } from '@/pantallas/cobro/CapaCobro';
import { Catalogo } from './Catalogo';
import { DialogoDescuento } from './DialogoDescuento';
import { HojaPersonalizacion } from './HojaPersonalizacion';
import { PanelVenta } from './PanelVenta';
import { ResultadoVenta } from './ResultadoVenta';
import { construirTicketVenta } from '@/impresion/ticket';
import { useImpresora } from '@/impresion/usarImpresora';

type Personalizacion = { producto: Producto; linea?: LineaCarrito };

export function NuevaVenta() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const config = useConfig();
  const categorias = useCategorias();
  const productos = useProductos();
  const grupos = useGruposModificadores();
  const { usuario, puede } = useUsuarioActivo();
  const carrito = useCarrito((s) => s.carrito);
  const ultimaVenta = useCarrito((s) => s.ultimaVenta);
  const { agregar, reemplazar, terminarVenta } = useCarrito.getState();
  const [abriendo, setAbriendo] = useState(false);
  const [personalizando, setPersonalizando] = useState<Personalizacion | null>(null);
  const [ventaAbierta, setVentaAbierta] = useState(false);
  const [descontando, setDescontando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const impresora = useImpresora();

  if (turno === undefined || !config || !categorias || !productos || !grupos || !dispositivo || !usuario) {
    return null;
  }

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

  if (productos.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-seccion font-semibold">Aún no hay productos.</p>
        {puede('crearProductos') && (
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/menu/productos/nuevo" className={clasesBoton('oscuro', 'grande')}>
              Agregar producto
            </Link>
            <Boton tamano="grande" onClick={() => void cargarMenuDeEjemplo()}>
              Cargar menú de ejemplo
            </Boton>
          </div>
        )}
      </div>
    );
  }

  const totales = calcularTotales(carrito.lineas, carrito.descuento, config.ventas);
  const etiquetaDescuento =
    carrito.descuento?.tipo === 'porcentaje' ? `Descuento ${carrito.descuento.valor}%` : 'Descuento';
  const productoDe = (linea: LineaCarrito) => productos.find((p) => p.id === linea.productoId);

  async function confirmarVenta(pagos: Pago[]) {
    const fecha = ahoraISO();
    const venta = await registrarVenta(
      armarVenta({
        id: crypto.randomUUID(),
        fecha,
        dia: diaLocal(fecha),
        carrito,
        config: config!.ventas,
        pagos,
        turno: turno!,
        dispositivo: dispositivo!,
        cajero: refUsuario(usuario!),
      }),
    );
    terminarVenta({ ventaId: venta.id, folio: venta.folio, cambio: venta.cambio, total: venta.total });
    setCobrando(false);
    if (config!.ticket.imprimirAlCobrar) void impresora.imprimir(construirTicketVenta(venta, config!));
    setVentaAbierta(false);
  }

  function tocarProducto(producto: Producto) {
    if (gruposDelProducto(producto, grupos!).length > 0) return setPersonalizando({ producto });
    const categoria = categorias!.find((c) => c.id === producto.categoriaId);
    agregar(crearLinea({ producto, categoria, grupos: grupos! }));
  }

  const panel = (
    <PanelVenta
      totales={totales}
      etiquetaDescuento={etiquetaDescuento}
      mostrarIVA={config.ventas.tasaIVA > 0}
      resultado={ultimaVenta && <ResultadoVenta ultima={ultimaVenta} impresora={impresora} />}
      acciones={
        config.ventas.descuentosPermitidos && (
          <Boton className="flex-1" onClick={() => setDescontando(true)}>
            Descuento
          </Boton>
        )
      }
      puedeEditar={(l) => {
        const p = productoDe(l);
        return Boolean(p && gruposDelProducto(p, grupos).length > 0);
      }}
      alEditar={(linea) => {
        const producto = productoDe(linea);
        if (producto) setPersonalizando({ producto, linea });
      }}
      alCobrar={() => setCobrando(true)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 portrait:flex-col">
      <Catalogo categorias={categorias} productos={productos} alTocarProducto={tocarProducto} />
      <div className="flex w-[380px] shrink-0 flex-col border-l border-linea max-[1100px]:w-[340px] portrait:hidden">
        {panel}
      </div>
      <div className="flex gap-2 border-t border-linea bg-papel p-2 landscape:hidden">
        <Boton tamano="grande" className="flex-1" onClick={() => setVentaAbierta(true)}>
          Ver venta ({cantidadDeProductos(carrito)})
        </Boton>
        <Boton
          variante="dinero"
          tamano="grande"
          className="flex-1"
          disabled={carrito.lineas.length === 0}
          onClick={() => setCobrando(true)}
        >
          Cobrar <span className="cifras">{formatearDinero(totales.total)}</span>
        </Boton>
      </div>
      {ventaAbierta && (
        <Hoja titulo="Venta actual" alCerrar={() => setVentaAbierta(false)}>
          <div className="-m-4 flex h-[70vh] flex-col">{panel}</div>
        </Hoja>
      )}
      {cobrando && (
        <CapaCobro
          total={totales.total}
          config={config}
          alConfirmar={confirmarVenta}
          alVolver={() => setCobrando(false)}
        />
      )}
      {descontando && (
        <DialogoDescuento
          subtotal={totales.subtotal}
          config={config.ventas}
          alCerrar={() => setDescontando(false)}
        />
      )}
      {personalizando && (
        <HojaPersonalizacion
          producto={personalizando.producto}
          categoria={categorias.find((c) => c.id === personalizando.producto.categoriaId)}
          grupos={grupos}
          linea={personalizando.linea}
          alTerminar={(linea) => {
            if (personalizando.linea) reemplazar(personalizando.linea.id, linea);
            else agregar(linea);
            setPersonalizando(null);
          }}
          alCerrar={() => setPersonalizando(null)}
        />
      )}
    </div>
  );
}
