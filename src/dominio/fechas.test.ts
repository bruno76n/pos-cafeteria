import { describe, expect, test } from 'vitest';
import {
  diaLocal,
  diasDelRango,
  diasEntre,
  finDelDia,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  horaLocal,
  inicioDelDia,
  rangoPredefinido,
  sumarDias,
} from './fechas';

describe('diaLocal', () => {
  test('usa la zona de México, no UTC', () => {
    // 20 de septiembre 03:30 UTC = 19 de septiembre 21:30 en CDMX
    expect(diaLocal('2026-09-20T03:30:00.000Z')).toBe('2026-09-19');
    expect(diaLocal('2026-09-20T06:00:00.000Z')).toBe('2026-09-20');
  });
  test('cruce de medianoche UTC', () => {
    expect(diaLocal('2026-09-19T23:59:59.999Z')).toBe('2026-09-19');
    expect(diaLocal('2026-09-20T00:00:00.000Z')).toBe('2026-09-19');
    expect(diaLocal('2026-09-20T05:59:59.999Z')).toBe('2026-09-19');
  });
  test('acepta otra zona', () => {
    expect(diaLocal('2026-09-20T03:30:00.000Z', 'UTC')).toBe('2026-09-20');
  });
  test('horaLocal', () => {
    expect(horaLocal('2026-09-19T14:42:00.000Z')).toBe(8);
  });
});

describe('inicio y fin de día', () => {
  test('medianoche local en UTC', () => {
    expect(inicioDelDia('2026-09-19').toISOString()).toBe('2026-09-19T06:00:00.000Z');
    expect(finDelDia('2026-09-19').toISOString()).toBe('2026-09-20T05:59:59.999Z');
  });
  test('zona con horario de verano', () => {
    expect(inicioDelDia('2026-07-01', 'America/New_York').toISOString()).toBe('2026-07-01T04:00:00.000Z');
    expect(inicioDelDia('2026-01-15', 'America/New_York').toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });
  test('un instante cae dentro de su día', () => {
    const f = '2026-09-20T02:00:00.000Z';
    const dia = diaLocal(f);
    expect(inicioDelDia(dia).getTime()).toBeLessThanOrEqual(Date.parse(f));
    expect(finDelDia(dia).getTime()).toBeGreaterThanOrEqual(Date.parse(f));
  });
});

describe('aritmética de días', () => {
  test('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
  });
  test('diasEntre y diasDelRango', () => {
    expect(diasEntre('2026-09-01', '2026-09-30')).toBe(29);
    expect(diasDelRango({ desde: '2026-09-29', hasta: '2026-10-02' })).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });
});

describe('rangos predefinidos', () => {
  const sabado = '2026-09-19';
  test('hoy y ayer', () => {
    expect(rangoPredefinido('hoy', sabado)).toEqual({ desde: sabado, hasta: sabado });
    expect(rangoPredefinido('ayer', sabado)).toEqual({ desde: '2026-09-18', hasta: '2026-09-18' });
  });
  test('esta semana empieza en lunes', () => {
    expect(rangoPredefinido('semana', sabado)).toEqual({ desde: '2026-09-14', hasta: sabado });
    expect(rangoPredefinido('semana', '2026-09-14')).toEqual({ desde: '2026-09-14', hasta: '2026-09-14' });
    expect(rangoPredefinido('semana', '2026-09-20')).toEqual({ desde: '2026-09-14', hasta: '2026-09-20' });
  });
  test('este mes', () => {
    expect(rangoPredefinido('mes', sabado)).toEqual({ desde: '2026-09-01', hasta: sabado });
  });
});

describe('formato', () => {
  test('dd/mm/aaaa HH:mm en hora local', () => {
    expect(formatearFechaHora('2026-09-19T14:42:10.123Z')).toBe('19/09/2026 08:42');
    expect(formatearFechaHora('2026-09-20T01:05:00.000Z')).toBe('19/09/2026 19:05');
    expect(formatearHora('2026-09-19T14:42:10.123Z')).toBe('08:42');
    expect(formatearFecha('2026-09-19T14:42:10.123Z')).toBe('19/09/2026');
    expect(formatearFecha('2026-09-19')).toBe('19/09/2026');
  });
});
