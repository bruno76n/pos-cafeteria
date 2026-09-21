// Fechas de negocio: hora del dispositivo (ISO 8601) + `dia` (YYYY-MM-DD) en la zona del negocio.
// Solo Intl; nada de librerías de fechas.

export const ZONA_NEGOCIO = 'America/Mexico_City';

/** Días de ventas, movimientos, devoluciones y turnos que guarda la tablet. */
export const DIAS_LOCALES = 35;

type Entrada = Date | string | number;

const aFecha = (f: Entrada) => (f instanceof Date ? f : new Date(f));

function partes(fecha: Entrada, zona: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(aFecha(fecha)).map((x) => [x.type, x.value]));
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    segundo: Number(p.second),
  };
}

const dos = (n: number) => String(n).padStart(2, '0');

export function ahoraISO(): string {
  return new Date().toISOString();
}

/** Día de negocio (YYYY-MM-DD) de un instante, en la zona del negocio. */
export function diaLocal(fecha: Entrada = new Date(), zona = ZONA_NEGOCIO): string {
  const p = partes(fecha, zona);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

/** Hora local (0–23) de un instante. */
export function horaLocal(fecha: Entrada, zona = ZONA_NEGOCIO): number {
  return partes(fecha, zona).hora;
}

/** Minutos que la zona está adelantada respecto a UTC en ese instante (México: -360). */
function desfase(instante: Date, zona: string): number {
  const p = partes(instante, zona);
  const comoUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUTC - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/** Instante en que empieza un día de negocio (00:00 local). */
export function inicioDelDia(dia: string, zona = ZONA_NEGOCIO): Date {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const utc = Date.UTC(a, m - 1, d);
  const aprox = new Date(utc - desfase(new Date(utc), zona) * 60000);
  return new Date(utc - desfase(aprox, zona) * 60000);
}

/** Último milisegundo de un día de negocio. */
export function finDelDia(dia: string, zona = ZONA_NEGOCIO): Date {
  return new Date(inicioDelDia(sumarDias(dia, 1), zona).getTime() - 1);
}

export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

/** Días naturales entre dos días (hasta − desde). */
export function diasEntre(desde: string, hasta: string): number {
  const ms = (dia: string) => {
    const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(hasta) - ms(desde)) / 86400000);
}

/** Lista de días de un rango, ambos incluidos. */
export function diasDelRango(rango: RangoDias): string[] {
  const n = diasEntre(rango.desde, rango.hasta);
  return Array.from({ length: n + 1 }, (_, i) => sumarDias(rango.desde, i));
}

export interface RangoDias {
  desde: string;
  hasta: string;
}

export type RangoPredefinido = 'hoy' | 'ayer' | 'semana' | 'mes';

/** Hoy, Ayer, Esta semana (desde el lunes) y Este mes, relativos a `hoy`. */
export function rangoPredefinido(tipo: RangoPredefinido, hoy: string = diaLocal()): RangoDias {
  switch (tipo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer': {
      const ayer = sumarDias(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case 'semana': {
      const [a, m, d] = hoy.split('-').map(Number) as [number, number, number];
      const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
      return { desde: sumarDias(hoy, -((diaSemana + 6) % 7)), hasta: hoy };
    }
    case 'mes':
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  }
}

/** "19/09/2026 08:42" */
export function formatearFechaHora(fecha: Entrada, zona = ZONA_NEGOCIO): string {
  const p = partes(fecha, zona);
  return `${dos(p.dia)}/${dos(p.mes)}/${p.anio} ${dos(p.hora)}:${dos(p.minuto)}`;
}

/** "19/09/2026" a partir de un instante o de un día YYYY-MM-DD. */
export function formatearFecha(fecha: Entrada, zona = ZONA_NEGOCIO): string {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [a, m, d] = fecha.split('-');
    return `${d}/${m}/${a}`;
  }
  return formatearFechaHora(fecha, zona).slice(0, 10);
}

/** "08:42" */
export function formatearHora(fecha: Entrada, zona = ZONA_NEGOCIO): string {
  return formatearFechaHora(fecha, zona).slice(11);
}
