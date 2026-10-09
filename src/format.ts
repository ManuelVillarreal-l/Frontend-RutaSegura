// Colombia-time formatting and small Spanish labels that are not catalogs
// (catalog labels such as roles, weather or trip status come from the database).

import type { Risk } from "./types";

export const TIME_ZONE = "America/Bogota";

export const RISK_LABEL: Record<Risk, string> = { low: "Bajo", medium: "Medio", high: "Alto" };
export const DIRECTION_LABEL: Record<string, string> = { outbound: "Ida al colegio", return: "Regreso a casa" };

// The API stores times in UTC without a "Z"; add it so the browser converts correctly.
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

export function formatTime(value: string | null): string {
  if (!value) return "—";
  return parseUtc(value).toLocaleTimeString("es-CO", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return parseUtc(value).toLocaleString("es-CO", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Hoy", "Ayer" or a date, in Colombia time.
export function formatDay(value: string): string {
  const day = localDateKey(parseUtc(value));
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 86_400_000));
  if (day === today) return "Hoy";
  if (day === yesterday) return "Ayer";
  return parseUtc(value).toLocaleDateString("es-CO", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// A plain date "2026-10-09" shown as "vie 9 oct".
export function formatPlainDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (localDateKey(new Date()) === value) return "Hoy";
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function localDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

export function todayKey(): string {
  return localDateKey(new Date());
}

export function isToday(value: string): boolean {
  return localDateKey(parseUtc(value)) === todayKey();
}

export function localHour(): number {
  return Number(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false })) % 24;
}

export function minutesAgo(value: string | null): string {
  if (!value) return "sin datos";
  const minutes = Math.round((Date.now() - parseUtc(value).getTime()) / 60000);
  if (minutes < 1) return "hace menos de un minuto";
  if (minutes === 1) return "hace 1 minuto";
  if (minutes < 60) return `hace ${minutes} minutos`;
  return formatDateTime(value);
}

export function age(birthDate: string): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  const now = new Date();
  let years = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) years -= 1;
  return years;
}
