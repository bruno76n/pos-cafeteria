import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { Boton } from '@/componentes/Boton';
import { Cargando } from '@/componentes/Cargando';
import { Pestanas, type Pestana } from '@/componentes/Pestanas';
import { Shell } from '@/componentes/Shell';
import { SinAcceso } from '@/componentes/SinAcceso';
import { useConfig, useMeta } from '@/datos/consultas';
import { useEstadoSync } from '@/datos/estadoSync';
import { motorSync } from '@/datos/sync';
import { useBaseBloqueada } from '@/estado/baseLocal';
import { useDispositivoActual } from '@/estado/dispositivo';
import { useSeccionesPermitidas } from '@/estado/secciones';
import { useUsuarioActivo } from '@/estado/sesion';
import { Acceso } from '@/pantallas/acceso/Acceso';
import { Bienvenida } from '@/pantallas/acceso/Bienvenida';
import { Bloqueo } from '@/pantallas/acceso/Bloqueo';
import { ConfigurarDispositivo } from '@/pantallas/acceso/ConfigurarDispositivo';
import { CajaActual } from '@/pantallas/caja/CajaActual';
import { Cortes } from '@/pantallas/caja/Cortes';
import { DetalleCorte } from '@/pantallas/caja/DetalleCorte';
import { Movimientos } from '@/pantallas/caja/Movimientos';
import { ConfigDispositivo } from '@/pantallas/configuracion/Dispositivo';
import { ConfigImpresora } from '@/pantallas/configuracion/Impresora';
import { ConfigImpuestos } from '@/pantallas/configuracion/Impuestos';
import { ConfigNegocio } from '@/pantallas/configuracion/Negocio';
import { ConfigPagos } from '@/pantallas/configuracion/Pagos';
import { ConfigTicket } from '@/pantallas/configuracion/Ticket';
import { Inicio } from '@/pantallas/inicio/Inicio';
import { Categorias } from '@/pantallas/menu/Categorias';
import { EditarProducto } from '@/pantallas/menu/EditarProducto';
import { Ingredientes } from '@/pantallas/menu/Ingredientes';
import { Modificadores } from '@/pantallas/menu/Modificadores';
import { Productos } from '@/pantallas/menu/Productos';
import { Reportes } from '@/pantallas/reportes/Reportes';
import { Roles } from '@/pantallas/usuarios/Roles';
import { Usuarios } from '@/pantallas/usuarios/Usuarios';
import { NuevaVenta } from '@/pantallas/venta/NuevaVenta';
import { DetalleVenta } from '@/pantallas/ventas/DetalleVenta';
import { Devoluciones } from '@/pantallas/ventas/Devoluciones';
import { TicketPublico } from '@/pantallas/ticket/TicketPublico';
import { Historial } from '@/pantallas/ventas/Historial';
import { seccion, type IdSeccion } from '@/secciones';

type EstadoAcceso =
  'cargando' | 'acceso' | 'descargando' | 'dispositivo' | 'bienvenida' | 'bloqueo' | 'listo';

const PUERTAS: Partial<Record<EstadoAcceso, string>> = {
  acceso: '/acceso',
  dispositivo: '/dispositivo',
  bienvenida: '/bienvenida',
  bloqueo: '/bloqueo',
};

/** Guardas en orden: token → primer pull → dispositivo → configuración del negocio → usuario activo. */
function useEstadoAcceso(): EstadoAcceso {
  const sesion = useMeta('sesion');
  const primerPull = useMeta('primerPullCompleto');
  const dispositivo = useDispositivoActual();
  const config = useConfig();
  const { usuario } = useUsuarioActivo();
  if (sesion === undefined || primerPull === undefined || dispositivo === undefined || config === undefined) {
    return 'cargando';
  }
  if (!sesion || sesion.expirada) return 'acceso';
  if (!primerPull) return 'descargando';
  if (!dispositivo) return 'dispositivo';
  if (!config) return 'bienvenida';
  if (usuario === undefined) return 'cargando';
  if (!usuario) return 'bloqueo';
  return 'listo';
}

/** Espera inicial. Si la base local no se puede actualizar, explica qué hacer. */
function Esperando() {
  const bloqueada = useBaseBloqueada();
  const [tarda, setTarda] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTarda(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (!bloqueada && !tarda) return <Cargando />;
  return (
    <Cargando mensaje={bloqueada ? 'Hay que terminar de actualizar la app' : 'Esto está tardando'}>
      <p className="max-w-sm text-grafito-suave">
        Cierra las otras pestañas o ventanas de la app (incluida la app instalada) y vuelve a abrir esta.
      </p>
      <Boton variante="oscuro" onClick={() => location.reload()}>
        Recargar
      </Boton>
    </Cargando>
  );
}

function Descargando() {
  const error = useEstadoSync((s) => s.ultimoError);
  return (
    <Cargando mensaje="Descargando datos del servidor…">
      {error && (
        <>
          <p className="text-faltante">{error}</p>
          <Boton variante="oscuro" onClick={() => void motorSync.sincronizar({ forzar: true })}>
            Reintentar
          </Boton>
        </>
      )}
    </Cargando>
  );
}

function Guardian() {
  const estado = useEstadoAcceso();
  const { pathname, state } = useLocation();
  const desde = (state as { desde?: string } | null)?.desde;
  const conSesion = estado !== 'cargando' && estado !== 'acceso';

  useEffect(() => {
    if (!conSesion) return;
    motorSync.iniciar();
    return () => motorSync.detener();
  }, [conSesion]);

  if (estado === 'cargando') return <Esperando />;
  if (estado === 'descargando') return <Descargando />;
  const puerta = PUERTAS[estado];
  const enPuerta = Object.values(PUERTAS).includes(pathname);
  if (puerta && pathname !== puerta) {
    // Recuerda a dónde iba para volver ahí después del PIN.
    return <Navigate to={puerta} replace state={{ desde: enPuerta ? desde : pathname }} />;
  }
  if (estado === 'listo' && enPuerta) return <Navigate to={desde ?? '/inicio'} replace />;
  return <Outlet />;
}

/** Muestra "No tienes acceso" si el usuario activo no puede ver la sección. */
function ConPermiso({ id }: { id: IdSeccion }) {
  const permitidas = useSeccionesPermitidas();
  if (!permitidas.some((s) => s.id === id)) return <SinAcceso accion={seccion(id).accion} />;
  return <Outlet />;
}

function ConPestanas({ pestanas }: { pestanas: Pestana[] }) {
  return (
    <>
      <Pestanas pestanas={pestanas} />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  // Ticket digital público (QR): no pide sesión.
  { path: '/t/:id', element: <TicketPublico /> },
  {
    element: <Guardian />,
    children: [
      { path: '/acceso', element: <Acceso /> },
      { path: '/dispositivo', element: <ConfigurarDispositivo /> },
      { path: '/bienvenida', element: <Bienvenida /> },
      { path: '/bloqueo', element: <Bloqueo /> },
      {
        element: <Shell />,
        children: [
          { index: true, element: <Navigate to="/inicio" replace /> },
          { path: 'inicio', element: <Inicio /> },
          {
            path: 'venta',
            element: <ConPermiso id="venta" />,
            children: [{ index: true, element: <NuevaVenta /> }],
          },
          {
            path: 'ventas',
            element: <ConPermiso id="ventas" />,
            children: [
              {
                element: (
                  <ConPestanas
                    pestanas={[
                      { a: '/ventas', texto: 'Historial', exacta: true },
                      { a: '/ventas/devoluciones', texto: 'Devoluciones' },
                    ]}
                  />
                ),
                children: [
                  { index: true, element: <Historial /> },
                  { path: 'devoluciones', element: <Devoluciones /> },
                ],
              },
              { path: ':id', element: <DetalleVenta /> },
            ],
          },
          {
            path: 'menu',
            element: <ConPermiso id="menu" />,
            children: [
              {
                element: (
                  <ConPestanas
                    pestanas={[
                      { a: '/menu/productos', texto: 'Productos' },
                      { a: '/menu/categorias', texto: 'Categorías' },
                      { a: '/menu/ingredientes', texto: 'Ingredientes' },
                      { a: '/menu/modificadores', texto: 'Modificadores' },
                    ]}
                  />
                ),
                children: [
                  { index: true, element: <Navigate to="/menu/productos" replace /> },
                  { path: 'productos', element: <Productos /> },
                  { path: 'productos/:id', element: <EditarProducto /> },
                  { path: 'categorias', element: <Categorias /> },
                  { path: 'ingredientes', element: <Ingredientes /> },
                  { path: 'modificadores', element: <Modificadores /> },
                ],
              },
            ],
          },
          {
            path: 'caja',
            element: <ConPermiso id="caja" />,
            children: [
              {
                element: (
                  <ConPestanas
                    pestanas={[
                      { a: '/caja', texto: 'Caja actual', exacta: true },
                      { a: '/caja/movimientos', texto: 'Movimientos' },
                      { a: '/caja/cortes', texto: 'Cortes de caja' },
                    ]}
                  />
                ),
                children: [
                  { index: true, element: <CajaActual /> },
                  { path: 'movimientos', element: <Movimientos /> },
                  { path: 'cortes', element: <Cortes /> },
                  { path: 'cortes/:id', element: <DetalleCorte /> },
                ],
              },
              { path: 'cerrar', element: <Navigate to="/caja" replace /> },
            ],
          },
          {
            path: 'reportes',
            element: <ConPermiso id="reportes" />,
            children: [{ index: true, element: <Reportes /> }],
          },
          {
            path: 'usuarios',
            element: <ConPermiso id="usuarios" />,
            children: [
              {
                element: (
                  <ConPestanas
                    pestanas={[
                      { a: '/usuarios', texto: 'Usuarios', exacta: true },
                      { a: '/usuarios/roles', texto: 'Roles y permisos' },
                    ]}
                  />
                ),
                children: [
                  { index: true, element: <Usuarios /> },
                  { path: 'roles', element: <Roles /> },
                ],
              },
            ],
          },
          {
            path: 'configuracion',
            element: <ConPermiso id="configuracion" />,
            children: [
              {
                element: (
                  <ConPestanas
                    pestanas={[
                      { a: '/configuracion/negocio', texto: 'Negocio' },
                      { a: '/configuracion/impuestos', texto: 'Impuestos' },
                      { a: '/configuracion/pagos', texto: 'Pagos' },
                      { a: '/configuracion/ticket', texto: 'Ticket' },
                      { a: '/configuracion/impresora', texto: 'Impresora' },
                      { a: '/configuracion/dispositivo', texto: 'Dispositivo' },
                    ]}
                  />
                ),
                children: [
                  { index: true, element: <Navigate to="/configuracion/negocio" replace /> },
                  { path: 'negocio', element: <ConfigNegocio /> },
                  { path: 'impuestos', element: <ConfigImpuestos /> },
                  { path: 'pagos', element: <ConfigPagos /> },
                  { path: 'ticket', element: <ConfigTicket /> },
                  { path: 'impresora', element: <ConfigImpresora /> },
                  { path: 'dispositivo', element: <ConfigDispositivo /> },
                ],
              },
            ],
          },
          { path: '*', element: <Navigate to="/inicio" replace /> },
        ],
      },
    ],
  },
]);
