// =============================================================
// Manejo centralizado de zona horaria: Colombia (GMT-5).
//
// La base de datos guarda TODO en UTC (comportamiento estándar de
// Prisma/PostgreSQL). Estos helpers convierten/formatean SIEMPRE a
// hora de Colombia, sin depender de la zona horaria del servidor ni
// del navegador. Colombia no tiene horario de verano: offset fijo -5.
// =============================================================

export const CO_TZ = "America/Bogota";
const CO_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Formatea una fecha en hora de Colombia.
 * Ej: formatCO(sale.createdAt) -> "7/8/2026, 3:04 p. m."
 */
export function formatCO(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("es-CO", { timeZone: CO_TZ, ...opts }).format(d);
}

/**
 * Devuelve un Date "desplazado" de forma que los métodos getUTC*
 * (getUTCFullYear, getUTCMonth, getUTCDate, getUTCDay, getUTCHours…)
 * devuelvan la hora de pared de Colombia.
 *
 * Úsalo SOLO para cálculos de calendario en el servidor (agrupar por
 * día/semana/mes). No lo guardes en la base de datos.
 */
export function coDate(date: Date | string | number): Date {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getTime() - CO_OFFSET_MS);
}

/**
 * Rango [start, end) en instantes UTC que corresponde a un mes
 * calendario completo en hora de Colombia.
 * month es 1-12.
 */
export function coMonthRangeUTC(year: number, month: number) {
  // month-1 con Date.UTC maneja correctamente el desborde de diciembre.
  const start = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 5, 0, 0));
  return { start, end };
}
