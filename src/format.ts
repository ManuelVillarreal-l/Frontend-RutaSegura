// Spanish labels and Colombia-time formatting for values that come from the API.

import type { EventType, Role, TripStatus } from "./types";

export const TIME_ZONE = "America/Bogota";

export const ROLE_LABEL: Record<Role, string> = {
  coordinator: "Coordinador",
  driver: "Conductor",
  monitor: "Monitor",
  guardian: "Acudiente",
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  scheduled: "Programado",
  in_progress: "En recorrido",
  finished: "Finalizado",
};

export const EVENT_LABEL: Record<EventType, string> = {
  boarding: "Subió al bus",
  drop_off: "Bajó del bus",
};

// The API stores times in UTC without a "Z"; add it so the browser converts correctly.
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

export function formatTime(value: string | null): string {
  if (!value) return "—";
  return parseUtc(value).toLocaleTimeString("es-CO", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
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

// "hoy", "ayer" or a date, in Colombia time.
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

export function localDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

export function isToday(value: string): boolean {
  return localDateKey(parseUtc(value)) === localDateKey(new Date());
}




