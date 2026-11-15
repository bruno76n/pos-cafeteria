import { resumirTurno } from '@/dominio/caja';
import type { DescuentoCarrito } from '@/dominio/carrito';
import { armarVenta, type VentaNueva } from '@/dominio/cobro';
import {
  consolidarLineas,
  estaAbierta,
  lineaDeAnulacion,
  ordenarPedidos,
  siguienteComanda,
  siguienteNumeroCuenta,
} from '@/dominio/cuentas';
import { ahoraISO, diaLocal } from '@/dominio/fechas';
import { contadorInicial, siguienteFolio } from '@/dominio/folios';
import { configNueva, menuDeEjemplo, type MenuEjemplo } from '@/dominio/menuEjemplo';
import { crearPin } from '@/dominio/pin';
import { TABLAS_ULTIMO_GANA } from '@/dominio/reglasServidor';
import type {
  ConfigGeneral,
  Cuenta,
  Devolucion,
  Dispositivo,
  LineaVenta,
  MetodoPago,
  Movimiento,
  Operacion,
  Pago,
  Pedido,
  RefUsuario,
  RegistrosPorTabla,
  TablaSync,
  TipoPedido,
  Turno,
  Usuario,
  Venta,
} from '@/dominio/tipos';
import { bd, guardarMeta, leerMeta, type OperacionOutbox } from './bd';
import {
  aplicarDevolucion,
  calcularReembolso,
  puedeCancelar,
  puedeDevolver,
  type LineaADevolver,
} from '@/dominio/devoluciones';

// Toda escritura pasa por aquí: guarda el registro y agrega su operación a la outbox
// en UNA sola transacción de Dexie. Nada de fetch: la red la toca solo el motor de sync.

const oyentes = new Set<() => void>();

/** El motor de sync se suscribe para subir 1 s después de cada escritura. */
export function alEscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function avisar() {
  for (const o of oyentes) o();
}

function operacion(
  tabla: TablaSync,
  tipo: Operacion['tipo'],
  registroId: string,
  datos: object,
): OperacionOutbox {
  return {
    id: crypto.randomUUID(),
    tabla,
    tipo,
    registroId,
    datos: datos as Record<string, unknown>,
    creadaEn: ahoraISO(),
    intentos: 0,
    ultimoError: null,
  };
}

type SinFecha<T> = Omit<T, 'actualizadoEn'>;

type TablaCatalogo = 'categorias' | 'gruposModificadores' | 'ingredientes' | 'productos';

/** Crea un registro nuevo (ventas, movimientos, devoluciones, turnos o catálogo). */
export async function crear<T extends TablaSync>(tabla: T, registro: SinFecha<RegistrosPorTabla[T]>) {
  const completo = { ...registro, actualizadoEn: ahoraISO() } as RegistrosPorTabla[T];
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    await bd.tabla(tabla).add(completo as never);
    await bd.outbox.add(operacion(tabla, 'crear', completo.id, completo));
  });
  avisar();
  return completo;
}

/**
 * Guarda un registro completo de catálogo o configuración (gana el último en el servidor).
 * Crea si no existe; si existe, lo reemplaza.
 */
export async function guardar<T extends TablaSync>(tabla: T, registro: SinFecha<RegistrosPorTabla[T]>) {
  if (!TABLAS_ULTIMO_GANA.includes(tabla))
    throw new Error(`${tabla} no se guarda completo; usa crear/actualizar`);
  const completo = { ...registro, actualizadoEn: ahoraISO() } as RegistrosPorTabla[T];
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    const existe = await bd.tabla(tabla).get(completo.id);
    await bd.tabla(tabla).put(completo as never);
    await bd.outbox.add(operacion(tabla, existe ? 'actualizar' : 'crear', completo.id, completo));
  });
  avisar();
  return completo;
}

/** Guarda varios registros completos de catálogo en una sola transacción (p. ej. al reordenar). */
export async function guardarVarios<T extends TablaCatalogo>(
  tabla: T,
  registros: SinFecha<RegistrosPorTabla[T]>[],
) {
  const ahora = ahoraISO();
  const completos = registros.map((r) => ({ ...r, actualizadoEn: ahora }) as RegistrosPorTabla[T]);
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    await bd.tabla(tabla).bulkPut(completos as never);
    await bd.outbox.bulkAdd(completos.map((r) => operacion(tabla, 'actualizar', r.id, r)));
  });
  avisar();
}

/** Cambia campos de un registro (ventas: estado, cancelación, devuelto; movimientos: anulación; turnos). */
export async function actualizar<T extends 'ventas' | 'movimientos' | 'turnos'>(
  tabla: T,
  id: string,
  cambios: Partial<SinFecha<RegistrosPorTabla[T]>>,
) {
  const conFecha = { ...cambios, actualizadoEn: ahoraISO() };
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    const n = await bd.tabla(tabla).update(id, conFecha as never);
    if (n === 0) throw new Error(`No existe ${tabla}/${id}`);
    await bd.outbox.add(operacion(tabla, 'actualizar', id, conFecha));
  });
  avisar();
}

/** Borra categorías, grupos, ingredientes o productos (las ventas guardan copia). */
export async function borrar(tabla: TablaCatalogo, id: string) {
  await bd.transaction('rw', bd.tabla(tabla), bd.outbox, async () => {
    await bd.tabla(tabla).delete(id);
    await bd.outbox.add(operacion(tabla, 'borrar', id, { actualizadoEn: ahoraISO() }));
  });
  avisar();
}

/**
 * Asigna el folio del dispositivo, guarda la venta, sube el contador y encola ambas operaciones.
 * Llamar dentro de una transacción con `ventas`, `dispositivos` y `outbox`.
 */
async function guardarVenta(venta: VentaNueva): Promise<Venta> {
  const dispositivo = await bd.dispositivos.get(venta.dispositivoId);
  if (!dispositivo) throw new Error('Este dispositivo no está configurado.');
  const { folio, numero } = siguienteFolio(dispositivo);
  const ahora = ahoraISO();
  const guardada: Venta = { ...venta, folio, folioNumero: numero, actualizadoEn: ahora };
  const conContador = { ...dispositivo, ultimoFolio: numero, actualizadoEn: ahora };
  await bd.ventas.add(guardada);
  await bd.dispositivos.put(conContador);
  await bd.outbox.add(operacion('ventas', 'crear', guardada.id, guardada));
  await bd.outbox.add(operacion('dispositivos', 'actualizar', conContador.id, conContador));
  return guardada;
}

/** Registra una venta directa (sin cuenta): folio, venta y contador en la misma transacción. */
export async function registrarVenta(venta: VentaNueva): Promise<Venta> {
  const guardada = await bd.transaction('rw', bd.ventas, bd.dispositivos, bd.outbox, () =>
    guardarVenta(venta),
  );
  avisar();
  return guardada;
}

// Cuentas abiertas (docs/01-especificacion.md §5.2b). Las funciones `guardar…` y `cambiarCuenta`
// se llaman dentro de una transacción con `cuentasVenta`, `pedidos` y `outbox` (más `ventas` y
// `dispositivos` al cobrar): cada operación pública es UNA transacción.

export interface DatosApertura {
  nombre: string | null;
  turno: Pick<Turno, 'id'>;
  dispositivo: Pick<Dispositivo, 'id' | 'nombre'>;
  usuario: RefUsuario;
}

async function guardarCuenta(datos: DatosApertura): Promise<Cuenta> {
  const fecha = ahoraISO();
  const dia = diaLocal(fecha);
  const delDia = await bd.cuentasVenta
    .where('[dispositivoId+dia]')
    .equals([datos.dispositivo.id, dia])
    .toArray();
  const cuenta: Cuenta = {
    id: crypto.randomUUID(),
    dispositivoId: datos.dispositivo.id,
    dispositivoNombre: datos.dispositivo.nombre,
    turnoId: datos.turno.id,
    dia,
    numero: siguienteNumeroCuenta(delDia),
    nombre: datos.nombre?.trim() || null,
    estado: 'abierta',
    ventaId: null,
    cancelacion: null,
    abiertaPor: datos.usuario,
    fecha,
    actualizadoEn: fecha,
  };
  await bd.cuentasVenta.add(cuenta);
  await bd.outbox.add(operacion('cuentasVenta', 'crear', cuenta.id, cuenta));
  return cuenta;
}

async function guardarPedido(
  cuenta: Pick<Cuenta, 'id'>,
  datos: { tipo: TipoPedido; lineas: LineaVenta[]; usuario: RefUsuario; autorizadoPor: RefUsuario | null },
): Promise<Pedido> {
  const previos = await bd.pedidos.where('cuentaId').equals(cuenta.id).toArray();
  const fecha = ahoraISO();
  const pedido: Pedido = {
    id: crypto.randomUUID(),
    cuentaId: cuenta.id,
    numero: siguienteComanda(previos),
    tipo: datos.tipo,
    lineas: datos.lineas,
    enviadoPor: datos.usuario,
    autorizadoPor: datos.autorizadoPor,
    fecha,
    dia: diaLocal(fecha),
    actualizadoEn: fecha,
  };
  await bd.pedidos.add(pedido);
  await bd.outbox.add(operacion('pedidos', 'crear', pedido.id, pedido));
  return pedido;
}

async function cuentaAbierta(id: string): Promise<Cuenta> {
  const cuenta = await bd.cuentasVenta.get(id);
  if (!cuenta) throw new Error('La cuenta no existe.');
  if (!estaAbierta(cuenta)) throw new Error('Esta cuenta ya no está abierta.');
  return cuenta;
}

async function cambiarCuenta(
  cuenta: Cuenta,
  cambios: Partial<Pick<Cuenta, 'estado' | 'nombre' | 'ventaId' | 'cancelacion'>>,
): Promise<Cuenta> {
  const conFecha = { ...cambios, actualizadoEn: ahoraISO() };
  await bd.cuentasVenta.update(cuenta.id, conFecha);
  await bd.outbox.add(operacion('cuentasVenta', 'actualizar', cuenta.id, conFecha));
  return { ...cuenta, ...conFecha };
}

const pedidosDe = async (cuentaId: string) =>
  ordenarPedidos(await bd.pedidos.where('cuentaId').equals(cuentaId).toArray());

/** Abre una cuenta vacía (el número reinicia cada día en cada dispositivo). */
export async function abrirCuenta(datos: DatosApertura): Promise<Cuenta> {
  const cuenta = await bd.transaction('rw', bd.cuentasVenta, bd.outbox, () => guardarCuenta(datos));
  avisar();
  return cuenta;
}

/**
 * "Enviar a cocina": guarda el borrador como un pedido nuevo de la cuenta (o abre la cuenta y lo
 * guarda). Si la cuenta aún no tiene nombre y se da uno ("Para:"), se lo pone.
 */
export async function enviarPedido(datos: {
  destino: { cuentaId: string } | { abrir: DatosApertura };
  lineas: LineaVenta[];
  usuario: RefUsuario;
  nombre?: string | null;
}): Promise<{ cuenta: Cuenta; pedido: Pedido }> {
  if (datos.lineas.length === 0) throw new Error('No hay nada que enviar.');
  const resultado = await bd.transaction('rw', bd.cuentasVenta, bd.pedidos, bd.outbox, async () => {
    const nombre = datos.nombre?.trim() || null;
    let cuenta =
      'cuentaId' in datos.destino
        ? await cuentaAbierta(datos.destino.cuentaId)
        : await guardarCuenta({ ...datos.destino.abrir, nombre: datos.destino.abrir.nombre ?? nombre });
    if (nombre && !cuenta.nombre) cuenta = await cambiarCuenta(cuenta, { nombre });
    const pedido = await guardarPedido(cuenta, {
      tipo: 'normal',
      lineas: datos.lineas,
      usuario: datos.usuario,
      autorizadoPor: null,
    });
    return { cuenta, pedido };
  });
  avisar();
  return resultado;
}

/** Anula piezas de una línea ya enviada: se guarda como un pedido nuevo de tipo anulación. */
export async function anularLinea(datos: {
  cuentaId: string;
  lineaId: string;
  cantidad: number;
  usuario: RefUsuario;
  autorizadoPor: RefUsuario | null;
}): Promise<{ cuenta: Cuenta; pedido: Pedido }> {
  const resultado = await bd.transaction('rw', bd.cuentasVenta, bd.pedidos, bd.outbox, async () => {
    const cuenta = await cuentaAbierta(datos.cuentaId);
    const anulacion = lineaDeAnulacion(
      consolidarLineas(await pedidosDe(cuenta.id)),
      datos.lineaId,
      datos.cantidad,
    );
    if (!anulacion.ok) throw new Error(anulacion.error);
    const pedido = await guardarPedido(cuenta, {
      tipo: 'anulacion',
      lineas: [anulacion.linea],
      usuario: datos.usuario,
      autorizadoPor: datos.autorizadoPor,
    });
    return { cuenta, pedido };
  });
  avisar();
  return resultado;
}

interface DatosCobro {
  descuento: DescuentoCarrito | null;
  /** "Para:" del borrador; solo se usa si la cuenta no tiene nombre. */
  cliente: string | null;
  config: ConfigGeneral['ventas'];
  pagos: Pago[];
  turno: Pick<Turno, 'id'>;
  dispositivo: Pick<Dispositivo, 'id' | 'nombre'>;
  cajero: RefUsuario;
}

export interface ResultadoCobro {
  venta: Venta;
  cuenta: Cuenta;
  pedidos: Pedido[];
}

/** La venta junta las líneas vigentes de todos los pedidos; la cuenta queda cobrada. */
async function cobrarEnTx(cuenta: Cuenta, pedidos: Pedido[], datos: DatosCobro): Promise<ResultadoCobro> {
  const lineas = consolidarLineas(pedidos);
  if (lineas.length === 0) throw new Error('La cuenta no tiene productos que cobrar.');
  const fecha = ahoraISO();
  const nueva = armarVenta({
    id: crypto.randomUUID(),
    fecha,
    dia: diaLocal(fecha),
    lineas,
    descuento: datos.descuento,
    cliente: cuenta.nombre ?? datos.cliente,
    config: datos.config,
    pagos: datos.pagos,
    turno: datos.turno,
    dispositivo: datos.dispositivo,
    cajero: datos.cajero,
  });
  const venta = await guardarVenta({
    ...nueva,
    cuentaId: cuenta.id,
    cuentaNumero: cuenta.numero,
    cuentaComandas: pedidos.length,
  });
  const cobrada = await cambiarCuenta(cuenta, { estado: 'cobrada', ventaId: venta.id });
  return { venta, cuenta: cobrada, pedidos };
}

const TABLAS_COBRO = () => [bd.cuentasVenta, bd.pedidos, bd.ventas, bd.dispositivos, bd.outbox];

/** Cobra una cuenta abierta: folio, venta y cuenta cobrada en una sola transacción. */
export async function cobrarCuenta(datos: DatosCobro & { cuentaId: string }): Promise<ResultadoCobro> {
  const resultado = await bd.transaction('rw', TABLAS_COBRO(), async () => {
    const cuenta = await cuentaAbierta(datos.cuentaId);
    return cobrarEnTx(cuenta, await pedidosDe(cuenta.id), datos);
  });
  avisar();
  return resultado;
}

/**
 * Venta rápida de mostrador: al confirmar el pago abre la cuenta, guarda su único pedido, crea la
 * venta y deja la cuenta cobrada, todo en una transacción.
 */
export async function cobrarVentaRapida(
  datos: DatosCobro & { lineas: LineaVenta[] },
): Promise<ResultadoCobro> {
  const resultado = await bd.transaction('rw', TABLAS_COBRO(), async () => {
    const cuenta = await guardarCuenta({
      nombre: datos.cliente,
      turno: datos.turno,
      dispositivo: datos.dispositivo,
      usuario: datos.cajero,
    });
    const pedido = await guardarPedido(cuenta, {
      tipo: 'normal',
      lineas: datos.lineas,
      usuario: datos.cajero,
      autorizadoPor: null,
    });
    return cobrarEnTx(cuenta, [pedido], datos);
  });
  avisar();
  return resultado;
}

/** Cancela una cuenta abierta. Sin pedidos se descarta sin pedir motivo. */
export async function cancelarCuenta(datos: {
  cuentaId: string;
  motivo: string;
  usuario: RefUsuario;
  autorizadoPor: RefUsuario | null;
}): Promise<Cuenta> {
  const cuenta = await bd.transaction('rw', bd.cuentasVenta, bd.pedidos, bd.outbox, async () => {
    const abierta = await cuentaAbierta(datos.cuentaId);
    const sinPedidos = (await bd.pedidos.where('cuentaId').equals(abierta.id).count()) === 0;
    const motivo = datos.motivo.trim() || (sinPedidos ? 'Sin pedidos' : '');
    if (!motivo) throw new Error('Escribe el motivo.');
    return cambiarCuenta(abierta, {
      estado: 'cancelada',
      cancelacion: { motivo, usuario: datos.usuario, autorizadoPor: datos.autorizadoPor, fecha: ahoraISO() },
    });
  });
  avisar();
  return cuenta;
}

/**
 * Configura (o reconfigura) este dispositivo. El contador de folios arranca en el mayor entre
 * el de los dispositivos que usaban ese prefijo y el folio más alto de las ventas locales con él.
 */
export async function configurarDispositivo(datos: {
  nombre: string;
  tipo: 'caja' | 'consulta';
  prefijo: string | null;
}) {
  const id = (await leerMeta('dispositivoId')) ?? crypto.randomUUID();
  const actual = await bd.dispositivos.get(id);
  let ultimoFolio = actual?.ultimoFolio ?? 0;
  if (datos.prefijo && datos.prefijo !== actual?.prefijo) {
    const conPrefijo = await bd.dispositivos.filter((d) => d.prefijo === datos.prefijo).toArray();
    const folios = (await bd.ventas.where('folio').startsWith(`${datos.prefijo}-`).toArray()).map(
      (v) => v.folio,
    );
    ultimoFolio = contadorInicial(
      datos.prefijo,
      Math.max(0, ...conPrefijo.map((d) => d.ultimoFolio)),
      folios,
    );
  }
  const registro = await guardar('dispositivos', {
    id,
    ...datos,
    nombre: datos.nombre.trim(),
    ultimoFolio,
    activo: actual?.activo ?? true,
  });
  await guardarMeta('dispositivoId', id);
  return registro;
}

/** Guarda un menú completo con sus operaciones (llamar dentro de una transacción con esas tablas). */
async function escribirMenu(menu: MenuEjemplo) {
  await bd.categorias.bulkPut(menu.categorias);
  await bd.gruposModificadores.bulkPut(menu.gruposModificadores);
  await bd.ingredientes.bulkPut(menu.ingredientes);
  await bd.productos.bulkPut(menu.productos);
  await bd.outbox.bulkAdd([
    ...menu.categorias.map((c) => operacion('categorias', 'crear', c.id, c)),
    ...menu.gruposModificadores.map((g) => operacion('gruposModificadores', 'crear', g.id, g)),
    ...menu.ingredientes.map((i) => operacion('ingredientes', 'crear', i.id, i)),
    ...menu.productos.map((p) => operacion('productos', 'crear', p.id, p)),
  ]);
}

/**
 * Asistente inicial: configuración del negocio, Administrador y, si se pide, el menú de ejemplo
 * (sin sus usuarios demo). Todo en una transacción.
 */
export async function inicializarNegocio(datos: {
  nombreNegocio: string;
  admin: { nombre: string; pin: string };
  cargarMenu: boolean;
}): Promise<Usuario> {
  const ahora = ahoraISO();
  const config = { id: 'general' as const, datos: configNueva(datos.nombreNegocio), actualizadoEn: ahora };
  const admin: Usuario = {
    id: crypto.randomUUID(),
    nombre: datos.admin.nombre.trim(),
    rol: 'admin',
    ...(await crearPin(datos.admin.pin)),
    activo: true,
    actualizadoEn: ahora,
  };
  await bd.transaction(
    'rw',
    [bd.config, bd.usuarios, bd.categorias, bd.gruposModificadores, bd.ingredientes, bd.productos, bd.outbox],
    async () => {
      await bd.config.put(config);
      await bd.usuarios.put(admin);
      await bd.outbox.bulkAdd([
        operacion('config', 'crear', config.id, config),
        operacion('usuarios', 'crear', admin.id, admin),
      ]);
      if (datos.cargarMenu) await escribirMenu(menuDeEjemplo(ahora));
    },
  );
  avisar();
  return admin;
}

/** "Cargar menú de ejemplo": categorías, grupos, ingredientes y productos del ejemplo (sin usuarios). */
export async function cargarMenuDeEjemplo() {
  await bd.transaction(
    'rw',
    [bd.categorias, bd.gruposModificadores, bd.ingredientes, bd.productos, bd.outbox],
    () => escribirMenu(menuDeEjemplo(ahoraISO())),
  );
  avisar();
}

/** Abre la caja del dispositivo. Solo puede haber un turno abierto por dispositivo. */
export async function abrirTurno(datos: { fondoInicial: number; usuario: RefUsuario }): Promise<Turno> {
  const dispositivoId = await leerMeta('dispositivoId');
  const dispositivo = dispositivoId ? await bd.dispositivos.get(dispositivoId) : undefined;
  if (!dispositivo) throw new Error('Este dispositivo no está configurado.');
  const ahora = ahoraISO();
  const turno: Turno = {
    id: crypto.randomUUID(),
    dispositivoId: dispositivo.id,
    dispositivoNombre: dispositivo.nombre,
    estado: 'abierto',
    abiertoPor: datos.usuario,
    abiertoEn: ahora,
    dia: diaLocal(ahora),
    fondoInicial: datos.fondoInicial,
    actualizadoEn: ahora,
  };
  await bd.transaction('rw', bd.turnos, bd.outbox, async () => {
    const abierto = await bd.turnos
      .where('[dispositivoId+estado]')
      .equals([dispositivo.id, 'abierto'])
      .first();
    if (abierto) throw new Error('La caja ya está abierta.');
    await bd.turnos.add(turno);
    await bd.outbox.add(operacion('turnos', 'crear', turno.id, turno));
  });
  avisar();
  return turno;
}

/** Entrada, retiro o gasto de efectivo en el turno abierto. */
export async function registrarMovimiento(datos: {
  turno: Pick<Turno, 'id' | 'dispositivoId'>;
  tipo: Movimiento['tipo'];
  categoria: string | null;
  concepto: string;
  monto: number;
  usuario: RefUsuario;
}): Promise<Movimiento> {
  const fecha = ahoraISO();
  return crear('movimientos', {
    id: crypto.randomUUID(),
    turnoId: datos.turno.id,
    dispositivoId: datos.turno.dispositivoId,
    tipo: datos.tipo,
    categoria: datos.tipo === 'gasto' ? datos.categoria : null,
    concepto: datos.concepto.trim(),
    monto: datos.monto,
    usuario: datos.usuario,
    fecha,
    dia: diaLocal(fecha),
    anulado: false,
  });
}

/** Un movimiento equivocado se anula (queda visible y tachado); nunca se borra. */
export function anularMovimiento(id: string, usuario: RefUsuario) {
  return actualizar('movimientos', id, { anulado: true, anuladoPor: usuario, anuladoEn: ahoraISO() });
}

/**
 * Cierra el turno: calcula el resumen con los datos locales del turno y lo guarda con el conteo.
 * Después ya no cambia.
 */
export async function cerrarTurno(datos: {
  turnoId: string;
  usuario: RefUsuario;
  efectivoContado: number;
  conteo?: Record<string, number>;
  nota?: string;
}): Promise<Turno> {
  const turno = await bd.turnos.get(datos.turnoId);
  if (!turno || turno.estado !== 'abierto') throw new Error('La caja ya está cerrada.');
  const [ventas, movimientos, devoluciones] = await Promise.all([
    bd.ventas.where('turnoId').equals(turno.id).toArray(),
    bd.movimientos.where('turnoId').equals(turno.id).toArray(),
    bd.devoluciones.where('turnoId').equals(turno.id).toArray(),
  ]);
  const resumen = resumirTurno({ turno, ventas, movimientos, devoluciones, contado: datos.efectivoContado });
  const cambios = {
    estado: 'cerrado' as const,
    cerradoPor: datos.usuario,
    cerradoEn: ahoraISO(),
    efectivoContado: datos.efectivoContado,
    resumen,
    ...(datos.conteo ? { conteo: datos.conteo } : {}),
    ...(datos.nota?.trim() ? { nota: datos.nota.trim() } : {}),
  };
  await actualizar('turnos', turno.id, cambios);
  return { ...turno, ...cambios };
}

/** Cancela una venta pagada cuyo turno sigue abierto (el dinero se devolvió en el momento). */
export async function cancelarVenta(datos: {
  ventaId: string;
  motivo: string;
  usuario: RefUsuario;
  autorizadoPor: RefUsuario | null;
}) {
  const venta = await bd.ventas.get(datos.ventaId);
  const turno = venta ? await bd.turnos.get(venta.turnoId) : undefined;
  if (!venta || !puedeCancelar(venta, turno)) {
    throw new Error('Solo se cancelan ventas pagadas de un turno que sigue abierto.');
  }
  if (!datos.motivo.trim()) throw new Error('Escribe el motivo.');
  await actualizar('ventas', venta.id, {
    estado: 'cancelada',
    cancelacion: {
      motivo: datos.motivo.trim(),
      usuario: datos.usuario,
      autorizadoPor: datos.autorizadoPor,
      fecha: ahoraISO(),
    },
  });
}

/**
 * Devolución total o parcial: calcula el reembolso proporcional, guarda la devolución y actualiza
 * `devuelto` y el estado de la venta, en una transacción. En efectivo requiere la caja abierta en
 * este dispositivo (resta del efectivo esperado de ese turno).
 */
export async function registrarDevolucion(datos: {
  ventaId: string;
  seleccion: LineaADevolver[];
  metodo: MetodoPago;
  motivo: string;
  usuario: RefUsuario;
  autorizadoPor: RefUsuario | null;
}): Promise<Devolucion> {
  if (!datos.motivo.trim()) throw new Error('Escribe el motivo.');
  const dispositivoId = await leerMeta('dispositivoId');
  if (!dispositivoId) throw new Error('Este dispositivo no está configurado.');
  let devolucion: Devolucion | undefined;
  await bd.transaction('rw', [bd.ventas, bd.devoluciones, bd.turnos, bd.outbox], async () => {
    const venta = await bd.ventas.get(datos.ventaId);
    if (!venta || !puedeDevolver(venta)) throw new Error('Esta venta ya no admite devoluciones.');
    const turno = await bd.turnos.where('[dispositivoId+estado]').equals([dispositivoId, 'abierto']).first();
    if (datos.metodo === 'efectivo' && !turno) {
      throw new Error('Para devolver en efectivo abre la caja de este dispositivo.');
    }
    const previas = await bd.devoluciones.where('ventaId').equals(venta.id).toArray();
    const reembolso = calcularReembolso(venta, datos.seleccion, previas);
    if (!reembolso.ok) throw new Error(reembolso.error);
    const fecha = ahoraISO();
    devolucion = {
      id: crypto.randomUUID(),
      ventaId: venta.id,
      folioVenta: venta.folio,
      turnoId: turno?.id ?? null,
      dispositivoId,
      lineas: reembolso.lineas,
      monto: reembolso.monto,
      metodo: datos.metodo,
      motivo: datos.motivo.trim(),
      usuario: datos.usuario,
      autorizadoPor: datos.autorizadoPor,
      fecha,
      dia: diaLocal(fecha),
      actualizadoEn: fecha,
    };
    const cambios = { ...aplicarDevolucion(venta, devolucion, previas), actualizadoEn: fecha };
    await bd.devoluciones.add(devolucion);
    await bd.ventas.update(venta.id, cambios);
    await bd.outbox.bulkAdd([
      operacion('devoluciones', 'crear', devolucion.id, devolucion),
      operacion('ventas', 'actualizar', venta.id, cambios),
    ]);
  });
  avisar();
  return devolucion!;
}
