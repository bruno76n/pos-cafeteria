import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { Hoja } from '@/componentes/Hoja';
import {
  useCategorias,
  useConfig,
  useCuenta,
  useGruposModificadores,
  useIngredientes,
  usePedidosDeCuenta,
  useProductos,
  useTurnoAbierto,
} from '@/datos/consultas';
import {
  anularLinea,
  cargarMenuDeEjemplo,
  cobrarCuenta,
  cancelarCuenta,
  cobrarVentaRapida,
  enviarPedido,
  guardar,
} from '@/datos/escrituras';
import {
  calcularTotales,
  cantidadDeProductos,
  crearLinea,
  lineasParaVenta,
  type LineaCarrito,
} from '@/dominio/carrito';
import { consolidarLineas } from '@/dominio/cuentas';
import { formatearDinero } from '@/dominio/dinero';
import { sePersonaliza } from '@/dominio/personalizacion';
import type { Cuenta, LineaVenta, Pago, Pedido, Producto } from '@/dominio/tipos';
import { useCarrito } from '@/estado/carrito';
import { useDispositivoActual } from '@/estado/dispositivo';
import { refUsuario, useUsuarioActivo } from '@/estado/sesion';
import { FormularioAbrirCaja } from '@/pantallas/caja/FormularioAbrirCaja';
import { CapaCobro } from '@/pantallas/cobro/CapaCobro';
import { Catalogo } from './Catalogo';
import { DialogoDescuento } from './DialogoDescuento';
import { HojaPersonalizacion } from './HojaPersonalizacion';
import { DialogoAnular } from './DialogoAnular';
import { DialogoCancelarCuenta } from './DialogoCancelarCuenta';
import { PanelVenta } from './PanelVenta';
import { ResultadoVenta } from './ResultadoVenta';
import {
  datosDeCuenta,
  datosDePedido,
  trabajosDeCobro,
  trabajosDePedido,
  opcionesComanda,
  trabajosDeVentaRapida,
  vaACocina,
  type TrabajoImpresion,
} from '@/impresion/comanda';
import { ticketDeVenta } from '@/impresion/ticketVenta';
import { useImpresora } from '@/impresion/usarImpresora';
import { Confirmar } from '@/componentes/Confirmar';
import { useAutorizar } from '@/estado/autorizacion';

type Personalizacion = { producto: Producto; linea?: LineaCarrito };

export function NuevaVenta() {
  const dispositivo = useDispositivoActual();
  const turno = useTurnoAbierto(dispositivo?.id);
  const config = useConfig();
  const categorias = useCategorias();
  const productos = useProductos();
  const grupos = useGruposModificadores();
  const ingredientes = useIngredientes();
  const { usuario, puede } = useUsuarioActivo();
  const carrito = useCarrito((s) => s.carrito);
  const cuentaActivaId = useCarrito((s) => s.cuentaActivaId);
  const ultimaVenta = useCarrito((s) => s.ultimaVenta);
  const { agregar, reemplazar, terminarVenta } = useCarrito.getState();
  const cuenta = useCuenta(cuentaActivaId);
  const pedidos = usePedidosDeCuenta(cuentaActivaId);
  const [abriendo, setAbriendo] = useState(false);
  const [personalizando, setPersonalizando] = useState<Personalizacion | null>(null);
  const [ventaAbierta, setVentaAbierta] = useState(false);
  const [descontando, setDescontando] = useState(false);
  /** Total que se está cobrando (null = el cobro está cerrado). Se fija al abrirlo. */
  const [cobrando, setCobrando] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [anulando, setAnulando] = useState<LineaVenta | null>(null);
  const [cancelandoCuenta, setCancelandoCuenta] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [comandaPendiente, setComandaPendiente] = useState<TrabajoImpresion[] | null>(null);
  const [disponibilidad, setDisponibilidad] = useState<Producto | null>(null);
  const autorizar = useAutorizar();
  const impresora = useImpresora();

  // Si la cuenta activa ya no está abierta (se cobró o canceló en otro dispositivo), se suelta su borrador.
  useEffect(() => {
    if (cuentaActivaId && cuenta !== undefined && cuenta?.estado !== 'abierta') {
      useCarrito.getState().soltarCuenta(cuentaActivaId);
    }
  }, [cuentaActivaId, cuenta]);

  if (
    turno === undefined ||
    !config ||
    !categorias ||
    !productos ||
    !grupos ||
    !ingredientes ||
    !dispositivo ||
    !usuario
  ) {
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

  const enviadas = consolidarLineas(pedidos ?? []);
  const totales = calcularTotales(
    [...enviadas, ...lineasParaVenta(carrito)],
    carrito.descuento,
    config.ventas,
  );
  const etiquetaDescuento =
    carrito.descuento?.tipo === 'porcentaje' ? `Descuento ${carrito.descuento.valor}%` : 'Descuento';
  const productoDe = (linea: LineaCarrito) => productos.find((p) => p.id === linea.productoId);
  const sinNada = enviadas.length === 0 && carrito.lineas.length === 0;
  const cajero = refUsuario(usuario);

  /** Manda la comanda de un pedido (o su aviso de anulación) a la impresora y guarda el intento para reintentarlo. */
  function imprimirComanda(c: Cuenta, pedido: Pedido, opciones: { alEnviar: boolean }) {
    // Una reimpresión lleva su marca y "Comanda 2 de 3" solo si la comanda ya salió sola al enviarse.
    const reimpresion = !opciones.alEnviar && impresora.imprimirAlCobrar;
    const trabajos = trabajosDePedido(
      datosDePedido(c, pedido, {
        ...(opciones.alEnviar ? { dispositivoNombre: dispositivo!.nombre } : {}),
        ...(reimpresion ? { totalPedidos: pedidos?.length } : {}),
      }),
      config!,
      impresora.columnas,
      { reimpresion, anulacion: pedido.tipo === 'anulacion' },
    );
    if (trabajos.length === 0) return;
    setComandaPendiente(trabajos);
    void impresora.imprimirTrabajos(trabajos);
  }

  /** "Enviar a cocina": el borrador pasa a ser un pedido de la cuenta (que se abre si hace falta) y sale su comanda. */
  async function enviarACocina(): Promise<boolean> {
    if (cuentaActivaId && !cuenta) return false;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const { cuenta: enCurso, pedido } = await enviarPedido({
        destino: cuenta
          ? { cuentaId: cuenta.id }
          : { abrir: { nombre: null, turno: turno!, dispositivo: dispositivo!, usuario: cajero } },
        lineas: lineasParaVenta(carrito),
        usuario: cajero,
        nombre: carrito.cliente,
      });
      useCarrito.getState().pedidoEnviado(enCurso.id);
      if (impresora.imprimirAlCobrar) imprimirComanda(enCurso, pedido, { alEnviar: true });
      return true;
    } catch (e) {
      setErrorEnvio((e as Error).message);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  /** Cobrar: con una cuenta, lo que falte por enviar sale a cocina primero; sin cuenta es venta de mostrador. */
  async function empezarCobro() {
    if (cuentaActivaId && !cuenta) return;
    const total = totales.total;
    if (cuenta && carrito.lineas.length > 0 && !(await enviarACocina())) return;
    setCobrando(total);
  }

  async function anular(linea: LineaVenta, cantidad: number) {
    setAnulando(null);
    if (!cuenta) return;
    const permitido = await autorizar('cancelarVentas');
    if (!permitido) return;
    setErrorEnvio(null);
    try {
      const { cuenta: enCurso, pedido } = await anularLinea({
        cuentaId: cuenta.id,
        lineaId: linea.id,
        cantidad,
        usuario: permitido.usuario,
        autorizadoPor: permitido.autorizadoPor,
      });
      if (impresora.imprimirAlCobrar) imprimirComanda(enCurso, pedido, { alEnviar: true });
    } catch (e) {
      setErrorEnvio((e as Error).message);
    }
  }

  /** Cancela la cuenta (con permiso o PIN si ya tenía pedidos) y, si se pide, avisa a cocina. */
  async function cancelarLaCuenta(motivo: string, avisar: boolean) {
    setCancelandoCuenta(false);
    if (!cuenta) return;
    const permitido =
      enviadas.length > 0 || (pedidos?.length ?? 0) > 0
        ? await autorizar('cancelarVentas')
        : { usuario: cajero, autorizadoPor: null };
    if (!permitido) return;
    setErrorEnvio(null);
    try {
      const cancelada = await cancelarCuenta({
        cuentaId: cuenta.id,
        motivo,
        usuario: permitido.usuario,
        autorizadoPor: permitido.autorizadoPor,
      });
      if (avisar) {
        const trabajos = trabajosDePedido(datosDeCuenta(cancelada, enviadas), config!, impresora.columnas, {
          cancelada: true,
        });
        setComandaPendiente(trabajos);
        void impresora.imprimirTrabajos(trabajos);
      }
    } catch (e) {
      setErrorEnvio((e as Error).message);
    }
  }

  async function confirmarVenta(pagos: Pago[]) {
    const datos = {
      descuento: carrito.descuento,
      cliente: carrito.cliente,
      config: config!.ventas,
      pagos,
      turno: turno!,
      dispositivo: dispositivo!,
      cajero,
    };
    const {
      venta,
      cuenta: cobrada,
      pedidos: suyos,
    } = cuenta
      ? await cobrarCuenta({ ...datos, cuentaId: cuenta.id })
      : await cobrarVentaRapida({ ...datos, lineas: lineasParaVenta(carrito) });
    terminarVenta({ ventaId: venta.id, folio: venta.folio, cambio: venta.cambio, total: venta.total });
    setCobrando(null);
    setComandaPendiente(null);
    if (impresora.imprimirAlCobrar) {
      const { columnas } = impresora;
      const ticket = ticketDeVenta(venta, config!, { columnas });
      void impresora.imprimirTrabajos(
        cuenta
          ? trabajosDeCobro(ticket)
          : trabajosDeVentaRapida(datosDePedido(cobrada, suyos[0]!), config!, ticket, columnas),
      );
    }
    setVentaAbierta(false);
  }

  function tocarProducto(producto: Producto) {
    if (sePersonaliza(producto, grupos!)) return setPersonalizando({ producto });
    const categoria = categorias!.find((c) => c.id === producto.categoriaId);
    agregar(crearLinea({ producto, categoria, grupos: grupos! }));
  }

  const fallaComanda = Boolean(comandaPendiente && impresora.fallo?.fallidos.includes('comanda'));
  const aviso: ReactNode = (errorEnvio || fallaComanda) && (
    <div role="alert" className="flex flex-col gap-1 text-etiqueta">
      {errorEnvio && <p className="text-faltante">{errorEnvio}</p>}
      {fallaComanda && comandaPendiente && (
        <>
          <p className="text-faltante">{impresora.error}</p>
          {impresora.fallo?.ayuda && <p className="text-grafito-suave">{impresora.fallo.ayuda}</p>}
          <Boton
            disabled={impresora.imprimiendo}
            onClick={() => void impresora.imprimirTrabajos(comandaPendiente)}
          >
            Reintentar comanda
          </Boton>
        </>
      )}
    </div>
  );

  const panel = (
    <PanelVenta
      cuenta={cuenta ?? null}
      pedidos={pedidos ?? []}
      enviadas={enviadas}
      zona={config.zonaHoraria}
      totales={totales}
      etiquetaDescuento={etiquetaDescuento}
      mostrarIVA={config.ventas.tasaIVA > 0}
      resultado={
        !cuenta && ultimaVenta ? <ResultadoVenta ultima={ultimaVenta} impresora={impresora} /> : null
      }
      acciones={
        config.ventas.descuentosPermitidos && (
          <Boton className="flex-1" onClick={() => setDescontando(true)}>
            Descuento
          </Boton>
        )
      }
      puedeEditar={(l) => {
        const p = productoDe(l);
        return Boolean(p && sePersonaliza(p, grupos));
      }}
      alEditar={(linea) => {
        const producto = productoDe(linea);
        if (producto) setPersonalizando({ producto, linea });
      }}
      alEnviar={() => void enviarACocina()}
      enviando={enviando}
      alAnular={setAnulando}
      alImprimirPedido={(pedido) => cuenta && imprimirComanda(cuenta, pedido, { alEnviar: false })}
      imprimiendo={impresora.imprimiendo}
      aviso={aviso}
      alCancelarCuenta={() => setCancelandoCuenta(true)}
      alCobrar={() => void empezarCobro()}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 portrait:flex-col">
      <Catalogo
        categorias={categorias}
        productos={productos}
        alTocarProducto={tocarProducto}
        alMantenerProducto={setDisponibilidad}
      />
      <div className="flex w-[380px] shrink-0 flex-col border-l border-linea max-[1100px]:w-[340px] portrait:hidden">
        {panel}
      </div>
      <div className="flex gap-2 border-t border-linea bg-papel p-2 landscape:hidden">
        <Boton tamano="grande" className="flex-1" onClick={() => setVentaAbierta(true)}>
          Ver venta ({cantidadDeProductos(carrito) + enviadas.reduce((n, l) => n + l.cantidad, 0)})
        </Boton>
        <Boton
          variante="oscuro"
          tamano="grande"
          disabled={carrito.lineas.length === 0 || enviando}
          onClick={() => void enviarACocina()}
        >
          Enviar
        </Boton>
        <Boton
          variante="dinero"
          tamano="grande"
          className="flex-1"
          disabled={sinNada || enviando}
          onClick={() => void empezarCobro()}
        >
          Cobrar <span className="cifras">{formatearDinero(totales.total)}</span>
        </Boton>
      </div>
      {ventaAbierta && (
        <Hoja titulo="Venta actual" alCerrar={() => setVentaAbierta(false)}>
          <div className="-m-4 flex h-[70vh] flex-col">{panel}</div>
        </Hoja>
      )}
      {disponibilidad && (
        <Confirmar
          titulo={`¿Marcar ${disponibilidad.nombre} como ${disponibilidad.disponible ? 'no disponible' : 'disponible'}?`}
          textoAccion={disponibilidad.disponible ? 'Marcar no disponible' : 'Marcar disponible'}
          textoCancelar="Volver"
          variante="oscuro"
          alCancelar={() => setDisponibilidad(null)}
          alConfirmar={async () => {
            const producto = disponibilidad;
            setDisponibilidad(null);
            if (!(await autorizar('crearProductos'))) return;
            const { actualizadoEn: _, ...sinFecha } = producto;
            await guardar('productos', { ...sinFecha, disponible: !producto.disponible });
          }}
        >
          <p>
            {disponibilidad.disponible
              ? 'Se verá apagado y no se podrá vender hasta volver a activarlo.'
              : 'Se podrá vender de nuevo.'}
          </p>
        </Confirmar>
      )}
      {cobrando !== null && (
        <CapaCobro
          total={cobrando}
          config={config}
          alConfirmar={confirmarVenta}
          alVolver={() => setCobrando(null)}
        />
      )}
      {cancelandoCuenta && cuenta && (
        <DialogoCancelarCuenta
          cuenta={cuenta}
          tienePedidos={(pedidos?.length ?? 0) > 0}
          ofreceAviso={opcionesComanda(config.ticket).imprimir && enviadas.some(vaACocina)}
          alCancelar={(motivo, avisar) => void cancelarLaCuenta(motivo, avisar)}
          alCerrar={() => setCancelandoCuenta(false)}
        />
      )}
      {anulando && (
        <DialogoAnular
          linea={anulando}
          alAnular={(cantidad) => void anular(anulando, cantidad)}
          alCerrar={() => setAnulando(null)}
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
          ingredientes={ingredientes}
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
