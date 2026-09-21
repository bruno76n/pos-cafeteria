import type { Table } from 'dexie';
import { LIMITE_OPERACIONES_POR_LOTE } from '@/dominio/esquemas';
import { ahoraISO, DIAS_LOCALES, diaLocal, sumarDias } from '@/dominio/fechas';
import type { FilaPull, TablaSync } from '@/dominio/tipos';
import { api, ErrorApi, type ClienteApi } from './api';
import { bd, guardarMeta, leerMeta, type Meta, type OperacionOutbox } from './bd';
import { alEscribir } from './escrituras';
import { marcarEstado } from './estadoSync';

// Motor de sincronización (docs/02-arquitectura.md §6). Único lugar, junto con el login,
// que toca la red. Push de la outbox en lotes y pull paginado por rev.

/** Esperas crecientes tras errores de red o 5xx. */
export const ESPERAS_MS = [5_000, 15_000, 30_000, 60_000];
const INTERVALO_MS = 15_000;
const RETARDO_TRAS_ESCRITURA_MS = 1_000;

export const MENSAJE_SESION_EXPIRADA = 'La sesión de este dispositivo expiró. Vuelve a iniciar sesión.';

export type ResultadoSync = 'ok' | 'sin-sesion' | 'sesion-expirada' | 'error-red' | 'en-espera';

const clave = (tabla: TablaSync, id: string) => `${tabla}:${id}`;

/** El servidor acepta cuerpos de hasta 2 MB; los lotes se quedan por debajo con margen. */
export const MAXIMO_BYTES_LOTE = 1_500_000;

/** Operaciones en orden hasta 100 o ~1.5 MB (siempre al menos una). */
export function armarLote(pendientes: OperacionOutbox[], unaPorUna = false): OperacionOutbox[] {
  const lote: OperacionOutbox[] = [];
  let bytes = 0;
  for (const op of pendientes) {
    const tamano = JSON.stringify(op.datos).length;
    if (lote.length > 0 && (unaPorUna || bytes + tamano > MAXIMO_BYTES_LOTE)) break;
    lote.push(op);
    bytes += tamano;
  }
  return lote;
}

export class MotorSync {
  private pushEnCurso: Promise<ResultadoSync> | null = null;
  private pullEnCurso: Promise<ResultadoSync> | null = null;
  private fallosSeguidos = 0;
  private reintentarDesde = 0;
  private temporizadores: ReturnType<typeof setTimeout>[] = [];
  private limpiezas: (() => void)[] = [];

  constructor(
    private readonly cliente: ClienteApi = api,
    private readonly ahora: () => number = Date.now,
  ) {}

  /** Espera antes del siguiente intento según los fallos seguidos (0 si no hay fallos). */
  get esperaMs(): number {
    return this.fallosSeguidos === 0 ? 0 : ESPERAS_MS[Math.min(this.fallosSeguidos, ESPERAS_MS.length) - 1]!;
  }

  private async token(): Promise<string | null> {
    const sesion = await leerMeta('sesion');
    return sesion && !sesion.expirada ? sesion.token : null;
  }

  private async expirarSesion(sesion: Meta['sesion'] | undefined) {
    if (sesion) await guardarMeta('sesion', { ...sesion, expirada: true });
    marcarEstado({ ultimoError: MENSAJE_SESION_EXPIRADA });
  }

  private registrarFallo(error: ErrorApi) {
    this.fallosSeguidos += 1;
    this.reintentarDesde = this.ahora() + this.esperaMs;
    marcarEstado({ enLinea: false, ultimoError: error.message, esperaMs: this.esperaMs });
  }

  private registrarExito() {
    this.fallosSeguidos = 0;
    this.reintentarDesde = 0;
    marcarEstado({ enLinea: true, ultimoError: null, esperaMs: 0, ultimoExito: ahoraISO() });
  }

  /** Sube la outbox en orden, en lotes de hasta 100. Solo un push a la vez. */
  push(opciones: { forzar?: boolean } = {}): Promise<ResultadoSync> {
    this.pushEnCurso ??= this.hacerPush(opciones.forzar ?? false).finally(() => {
      this.pushEnCurso = null;
    });
    return this.pushEnCurso;
  }

  private async hacerPush(forzar: boolean): Promise<ResultadoSync> {
    if (!forzar && this.ahora() < this.reintentarDesde) return 'en-espera';
    // Tras un 400/413 se manda una por una para aislar la operación que el servidor no acepta.
    let unaPorUna = false;
    for (;;) {
      const sesion = await leerMeta('sesion');
      const token = await this.token();
      if (!token) return sesion ? 'sesion-expirada' : 'sin-sesion';
      const lote = armarLote(
        await bd.outbox.orderBy('orden').limit(LIMITE_OPERACIONES_POR_LOTE).toArray(),
        unaPorUna,
      );
      if (lote.length === 0) return 'ok';

      marcarEstado({ sincronizando: true });
      try {
        const operaciones = lote.map(({ orden: _o, intentos: _i, ultimoError: _u, ...op }) => op);
        const { resultados } = await this.cliente.push(token, operaciones);
        const sinRespuesta = await this.aplicarResultados(lote, resultados);
        if (sinRespuesta > 0) throw new ErrorApi('red', 'Respuesta incompleta del servidor.');
        this.registrarExito();
      } catch (error) {
        if (!(error instanceof ErrorApi)) throw error;
        if (error.tipo === 'sesion') {
          await this.expirarSesion(sesion);
          return 'sesion-expirada';
        }
        if (error.tipo === 'peticion') {
          // El servidor no acepta el lote (inválido o demasiado grande): no se reintenta igual.
          if (lote.length > 1) {
            unaPorUna = true;
          } else {
            await this.aplicarResultados(lote, [
              { id: lote[0]!.id, resultado: 'rechazada', motivo: error.message },
            ]);
          }
          continue;
        }
        await bd.outbox.bulkUpdate(
          lote.map((o) => ({
            key: o.orden!,
            changes: { intentos: o.intentos + 1, ultimoError: error.message },
          })),
        );
        this.registrarFallo(error);
        return 'error-red';
      } finally {
        marcarEstado({ sincronizando: false });
      }
    }
  }

  private async aplicarResultados(
    lote: OperacionOutbox[],
    resultados: { id: string; resultado: string; motivo?: string }[],
  ): Promise<number> {
    const porId = new Map(resultados.map((r) => [r.id, r]));
    let sinRespuesta = 0;
    await bd.transaction('rw', bd.outbox, bd.erroresSync, async () => {
      for (const op of lote) {
        const r = porId.get(op.id);
        if (!r) {
          sinRespuesta += 1; // se queda en la outbox para el siguiente intento
          continue;
        }
        if (r.resultado === 'rechazada') {
          await bd.erroresSync.put({
            id: op.id,
            tabla: op.tabla,
            tipo: op.tipo,
            registroId: op.registroId,
            datos: op.datos,
            creadaEn: op.creadaEn,
            motivo: r.motivo ?? 'Rechazada por el servidor.',
            fecha: ahoraISO(),
          });
        }
        await bd.outbox.delete(op.orden!);
      }
    });
    return sinRespuesta;
  }

  /** Baja los cambios del servidor desde el cursor, página por página. */
  pull(): Promise<ResultadoSync> {
    this.pullEnCurso ??= this.hacerPull().finally(() => {
      this.pullEnCurso = null;
    });
    return this.pullEnCurso;
  }

  private async hacerPull(): Promise<ResultadoSync> {
    const sesion = await leerMeta('sesion');
    const token = await this.token();
    if (!token) return sesion ? 'sesion-expirada' : 'sin-sesion';
    marcarEstado({ sincronizando: true });
    try {
      for (;;) {
        const desde = (await leerMeta('cursorPull')) ?? 0;
        const pagina = await this.cliente.pull(token, desde);
        await this.aplicarPagina(pagina.filas, pagina.rev);
        if (!pagina.hayMas) break;
      }
      await guardarMeta('primerPullCompleto', true);
      this.registrarExito();
      return 'ok';
    } catch (error) {
      if (!(error instanceof ErrorApi)) throw error;
      if (error.tipo === 'sesion') {
        await this.expirarSesion(sesion);
        return 'sesion-expirada';
      }
      this.registrarFallo(error);
      return 'error-red';
    } finally {
      marcarEstado({ sincronizando: false });
    }
  }

  /** Aplica una página del pull sin pisar registros con operaciones pendientes (lo local gana). */
  private async aplicarPagina(filas: FilaPull[], rev: number) {
    const tablas = [...new Set(filas.map((f) => f.tabla))].map((t) => bd.tabla(t));
    await bd.transaction('rw', [bd.outbox, bd.meta, bd.dispositivos, ...tablas], async () => {
      const pendientes = new Set((await bd.outbox.toArray()).map((o) => clave(o.tabla, o.registroId)));
      const miDispositivo = await leerMeta('dispositivoId');
      for (const fila of filas) {
        const id = String(fila.registro.id);
        if (pendientes.has(clave(fila.tabla, id))) continue;
        const tabla = bd.tabla(fila.tabla);
        if (fila.borrado) {
          await tabla.delete(id);
          continue;
        }
        let registro = fila.registro;
        if (fila.tabla === 'dispositivos' && id === miDispositivo) {
          // El contador de folios local nunca retrocede.
          const local = await bd.dispositivos.get(id);
          const remoto = Number(registro.ultimoFolio ?? 0);
          registro = { ...registro, ultimoFolio: Math.max(remoto, local?.ultimoFolio ?? 0) };
        }
        await tabla.put(registro as never);
      }
      await guardarMeta('cursorPull', rev);
    });
  }

  /** Push y luego pull. */
  async sincronizar(opciones: { forzar?: boolean } = {}): Promise<ResultadoSync> {
    const r = await this.push(opciones);
    if (r === 'sesion-expirada' || r === 'sin-sesion') return r;
    if (r === 'error-red' || r === 'en-espera') return r;
    await this.limpiarAntiguos();
    return this.pull();
  }

  /**
   * Una vez al día: borra ventas, movimientos, devoluciones y turnos cerrados de hace más de
   * 35 días que no tengan operaciones pendientes.
   */
  async limpiarAntiguos(hoy = diaLocal()): Promise<number> {
    if ((await leerMeta('ultimaLimpieza')) === hoy) return 0;
    const limite = sumarDias(hoy, -DIAS_LOCALES);
    let borrados = 0;
    await bd.transaction(
      'rw',
      [bd.ventas, bd.movimientos, bd.devoluciones, bd.turnos, bd.outbox, bd.meta],
      async () => {
        const pendientes = new Set((await bd.outbox.toArray()).map((o) => clave(o.tabla, o.registroId)));
        for (const tabla of ['ventas', 'movimientos', 'devoluciones', 'turnos'] as const) {
          const t = bd.tabla(tabla) as unknown as Table<{ id: string; dia: string; estado?: string }, string>;
          const viejos = await t
            .where('dia')
            .below(limite)
            .filter(
              (r) => !pendientes.has(clave(tabla, r.id)) && (tabla !== 'turnos' || r.estado === 'cerrado'),
            )
            .primaryKeys();
          await t.bulkDelete(viejos);
          borrados += viejos.length;
        }
        await guardarMeta('ultimaLimpieza', hoy);
      },
    );
    return borrados;
  }

  /** Arranca los disparadores: tras cada escritura, cada 15 s, al volver la red y al enfocar. */
  iniciar() {
    if (this.limpiezas.length > 0) return;
    const programar = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        this.temporizadores = this.temporizadores.filter((x) => x !== t);
        fn();
      }, ms);
      this.temporizadores.push(t);
    };
    const tras = () => programar(() => void this.sincronizar(), RETARDO_TRAS_ESCRITURA_MS);
    const intervalo = setInterval(() => void this.sincronizar(), INTERVALO_MS);
    const enLinea = () => {
      marcarEstado({ enLinea: true });
      void this.sincronizar({ forzar: true });
    };
    const sinLinea = () => marcarEstado({ enLinea: false });
    const alEnfocar = () => {
      if (document.visibilityState === 'visible') void this.sincronizar();
    };
    window.addEventListener('online', enLinea);
    window.addEventListener('offline', sinLinea);
    document.addEventListener('visibilitychange', alEnfocar);
    this.limpiezas.push(
      alEscribir(tras),
      () => clearInterval(intervalo),
      () => window.removeEventListener('online', enLinea),
      () => window.removeEventListener('offline', sinLinea),
      () => document.removeEventListener('visibilitychange', alEnfocar),
    );
    void this.sincronizar({ forzar: true });
  }

  detener() {
    for (const l of this.limpiezas) l();
    for (const t of this.temporizadores) clearTimeout(t);
    this.limpiezas = [];
    this.temporizadores = [];
  }
}

export const motorSync = new MotorSync();
