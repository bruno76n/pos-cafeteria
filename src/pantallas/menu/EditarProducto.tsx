import { ArrowLeft, ImagePlus, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Boton, clasesBoton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoDinero } from '@/componentes/CampoDinero';
import { Confirmar } from '@/componentes/Confirmar';
import { comprimirImagen } from '@/componentes/imagen';
import { Interruptor } from '@/componentes/Interruptor';
import { Pantalla } from '@/componentes/Pantalla';
import { Segmentos } from '@/componentes/Segmentos';
import { useCategorias, useGruposModificadores, useIngredientes, useProductos } from '@/datos/consultas';
import { borrar, guardar } from '@/datos/escrituras';
import { esquemaProducto } from '@/dominio/esquemas';
import { siguienteOrden } from '@/dominio/orden';
import type { Categoria, GrupoModificadores, Ingrediente, Producto } from '@/dominio/tipos';
import { pedirAutorizacion } from '@/estado/autorizacion';
import { useUsuarioActivo } from '@/estado/sesion';
import { BotonProducto } from '@/pantallas/venta/Catalogo';
import { ArmadoProducto } from './ArmadoProducto';
import { OpcionesAdicionales } from './OpcionesAdicionales';
import { TamanosProducto } from './TamanosProducto';

type ProductoEditable = Omit<Producto, 'actualizadoEn'>;

function Formulario({
  inicial,
  esNuevo,
  categorias,
  grupos,
  ingredientes,
  productos,
}: {
  inicial: ProductoEditable;
  esNuevo: boolean;
  categorias: Categoria[];
  grupos: GrupoModificadores[];
  ingredientes: Ingrediente[];
  productos: Producto[];
}) {
  const navegar = useNavigate();
  const { puede } = useUsuarioActivo();
  const [p, setP] = useState(inicial);
  const [precioAutorizado, setPrecioAutorizado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const editaMenu = puede('crearProductos');
  const editaPrecio = puede('modificarPrecios') || precioAutorizado;
  const cambiar = (cambios: Partial<ProductoEditable>) => setP((x) => ({ ...x, ...cambios }));
  const categoria = categorias.find((c) => c.id === p.categoriaId);

  async function elegirImagen(archivo: File | undefined) {
    if (!archivo) return;
    setErrorImagen(null);
    try {
      cambiar({ imagen: await comprimirImagen(archivo) });
    } catch (e) {
      setErrorImagen((e as Error).message);
    }
  }

  async function guardarProducto() {
    const listo = {
      ...p,
      nombre: p.nombre.trim(),
      descripcion: p.descripcion.trim(),
      tamanos: p.tamanos.map((t) => ({ ...t, nombre: t.nombre.trim() })),
      armado: p.armado && {
        ...p.armado,
        permitidos:
          p.armado.permitidos && p.armado.permitidos.filter((id) => ingredientes.some((i) => i.id === id)),
      },
    };
    if (!listo.nombre) return setError('Escribe el nombre.');
    if (listo.tamanos.some((t) => !t.nombre)) return setError('Escribe el nombre de cada tamaño.');
    if (listo.armado?.permitidos?.length === 0) return setError('Elige al menos un ingrediente permitido.');
    if (!listo.categoriaId) return setError('Elige la categoría.');
    if (esNuevo || listo.categoriaId !== inicial.categoriaId) {
      listo.orden = siguienteOrden(
        productos.filter((x) => x.categoriaId === listo.categoriaId && x.id !== listo.id),
      );
    }
    const r = esquemaProducto.safeParse({ ...listo, actualizadoEn: new Date().toISOString() });
    if (!r.success) return setError(r.error.issues[0]?.message ?? 'Revisa los datos.');
    await guardar('productos', listo);
    navegar('/menu/productos');
  }

  return (
    <Pantalla
      titulo={esNuevo ? 'Nuevo producto' : p.nombre || 'Producto'}
      acciones={
        <Link to="/menu/productos" className={clasesBoton('claro')}>
          <ArrowLeft aria-hidden /> Productos
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-5 rounded-hoja border border-linea bg-papel p-5">
          <Campo
            etiqueta="Nombre"
            value={p.nombre}
            maxLength={40}
            disabled={!editaMenu}
            onChange={(e) => cambiar({ nombre: e.target.value })}
          />
          {editaMenu ? (
            <Segmentos
              etiqueta="Categoría"
              valor={p.categoriaId}
              alCambiar={(categoriaId) => cambiar({ categoriaId })}
              opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))}
            />
          ) : (
            <p>Categoría: {categoria?.nombre}</p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {p.tamanos.length === 0 && (
              <CampoDinero
                etiqueta="Precio"
                className="w-48"
                valor={p.precio}
                disabled={!editaPrecio}
                alCambiar={(precio) => cambiar({ precio: precio ?? 0 })}
              />
            )}
            {!editaPrecio && (
              <Boton
                onClick={async () =>
                  setPrecioAutorizado(Boolean(await pedirAutorizacion('modificarPrecios')))
                }
              >
                Pedir autorización para cambiar el precio
              </Boton>
            )}
          </div>
          <TamanosProducto
            tamanos={p.tamanos}
            otrosProductos={productos.filter((x) => x.id !== p.id)}
            editaMenu={editaMenu}
            editaPrecio={editaPrecio}
            alCambiar={(tamanos) => cambiar({ tamanos })}
          />
          <ArmadoProducto
            producto={p}
            ingredientes={ingredientes}
            editaMenu={editaMenu}
            editaPrecio={editaPrecio}
            alCambiar={cambiar}
          />
          <Campo
            etiqueta="Descripción"
            value={p.descripcion}
            maxLength={120}
            disabled={!editaMenu}
            onChange={(e) => cambiar({ descripcion: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3">
            {p.imagen && (
              <img src={p.imagen} alt="Imagen del producto" className="size-20 rounded-boton object-cover" />
            )}
            {editaMenu && (
              <label className={clasesBoton('claro')}>
                <ImagePlus aria-hidden /> {p.imagen ? 'Cambiar imagen' : 'Tomar foto o elegir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => void elegirImagen(e.target.files?.[0])}
                />
              </label>
            )}
            {p.imagen && editaMenu && (
              <Boton variante="fantasma" onClick={() => cambiar({ imagen: null })}>
                Quitar imagen
              </Boton>
            )}
            {errorImagen && (
              <p className="text-faltante" role="alert">
                {errorImagen}
              </p>
            )}
          </div>
          <div className="max-w-sm">
            <Interruptor
              etiqueta="Disponible"
              descripcion="Si no, se ve apagado en Nueva venta."
              activo={p.disponible}
              deshabilitado={!editaMenu}
              alCambiar={(disponible) => cambiar({ disponible })}
            />
            <Interruptor
              etiqueta="Va a cocina"
              descripcion="Sale en la comanda de cocina. Apágalo si no se prepara (agua embotellada, café en grano)."
              activo={p.vaACocina}
              deshabilitado={!editaMenu}
              alCambiar={(vaACocina) => cambiar({ vaACocina })}
            />
          </div>
          <OpcionesAdicionales
            grupos={grupos}
            gruposIds={p.gruposIds}
            editaMenu={editaMenu}
            alCambiar={(gruposIds) => cambiar({ gruposIds })}
          />
          {error && (
            <p className="text-faltante" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            {!esNuevo && editaMenu ? (
              <Boton variante="peligro" tamano="grande" onClick={() => setEliminando(true)}>
                <Trash aria-hidden /> Eliminar
              </Boton>
            ) : (
              <span />
            )}
            <Boton
              variante="oscuro"
              tamano="grande"
              onClick={guardarProducto}
              disabled={!editaMenu && !editaPrecio}
            >
              Guardar
            </Boton>
          </div>
        </div>
        <aside className="flex flex-col gap-2" aria-label="Vista previa">
          <p className="text-etiqueta text-grafito-suave">Así se verá en Nueva venta</p>
          <BotonProducto
            producto={{ ...p, nombre: p.nombre || 'Producto', actualizadoEn: '' }}
            color={categoria?.color ?? '#5E6B73'}
            alTocar={() => {}}
          />
        </aside>
      </div>
      {eliminando && (
        <Confirmar
          titulo={`¿Eliminar ${inicial.nombre}?`}
          textoAccion="Eliminar"
          textoCancelar="Conservar"
          alConfirmar={async () => {
            await borrar('productos', inicial.id);
            navegar('/menu/productos');
          }}
          alCancelar={() => setEliminando(false)}
        >
          <p>Las ventas pasadas no cambian: guardan su propia copia del producto.</p>
        </Confirmar>
      )}
    </Pantalla>
  );
}

/** Crear o editar un producto (/menu/productos/nuevo o /menu/productos/:id). */
export function EditarProducto() {
  const { id } = useParams();
  const categorias = useCategorias();
  const grupos = useGruposModificadores();
  const ingredientes = useIngredientes();
  const productos = useProductos();
  const [idNuevo] = useState(() => crypto.randomUUID());
  if (!categorias || !grupos || !ingredientes || !productos) return null;

  const esNuevo = id === 'nuevo';
  const existente = productos.find((p) => p.id === id);
  if (!esNuevo && !existente) {
    return (
      <Pantalla titulo="Producto">
        <p className="text-grafito-suave">Este producto ya no existe.</p>
      </Pantalla>
    );
  }
  const inicial: ProductoEditable = existente ?? {
    id: idNuevo,
    nombre: '',
    descripcion: '',
    categoriaId: categorias[0]?.id ?? '',
    precio: 0,
    imagen: null,
    disponible: true,
    orden: 0,
    gruposIds: [],
    tamanos: [],
    armado: null,
    vaACocina: true,
  };
  return (
    <Formulario
      key={inicial.id}
      inicial={inicial}
      esNuevo={esNuevo}
      categorias={categorias}
      grupos={grupos}
      ingredientes={ingredientes}
      productos={productos}
    />
  );
}
