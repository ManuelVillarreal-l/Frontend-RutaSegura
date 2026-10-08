// Small HTTP client for the RutaSegura API.
// Messages shown to the user are in Spanish.

import type {
  AttendanceEvent,
  DelayPrediction,
  EventType,
  CheckInMethod,
  Route,
  Stop,
  Student,
  Trip,
  User,
} from "./types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "https://rutasegura-api-g7n4.onrender.com").replace(/\/$/, "");

const TOKEN_KEY = "rutasegura.token";
const SLOW_REQUEST_MS = 4000;

// ---------- Token storage (browser storage can fail in private mode) ----------

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore: the session simply won't survive a page reload.
  }
}

// ---------- Slow-server notice (the free server sleeps when idle) ----------

type SlowListener = (isSlow: boolean) => void;
const slowListeners = new Set<SlowListener>();
let pendingSlow = 0;

export function onSlowServer(listener: SlowListener): () => void {
  slowListeners.add(listener);
  return () => slowListeners.delete(listener);
}

function setSlow(delta: number) {
  pendingSlow += delta;
  slowListeners.forEach((listener) => listener(pendingSlow > 0));
}

// ---------- Errors ----------

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join(". ");
  }
  if (status === 0) return "No se pudo conectar con el servidor. Revise su conexión a internet.";
  return `El servidor respondió con un error (${status}).`;
}

// ---------- Request helper ----------

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = loadToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let markedSlow = false;
  const timer = window.setTimeout(() => {
    markedSlow = true;
    setSlow(1);
  }, SLOW_REQUEST_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, errorMessage(0, null));
  } finally {
    window.clearTimeout(timer);
    if (markedSlow) setSlow(-1);
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(response.status, errorMessage(response.status, body));
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

// ---------- Endpoints ----------

export const api = {
  login: (email: string, password: string) =>
    post<{ access_token: string; token_type: string }>("/api/auth/login", { email, password }),
  register: (data: { name: string; email: string; password: string; role: string }) =>
    post<User>("/api/auth/register", data),

  me: () => request<User>("/api/users/me"),
  users: () => request<User[]>("/api/users/"),

  routes: () => request<Route[]>("/api/routes/"),
  createRoute: (data: { name: string; description: string | null }) => post<Route>("/api/routes/", data),
  stops: (routeId: number) => request<Stop[]>(`/api/routes/${routeId}/stops`),
  createStop: (data: Omit<Stop, "id">) => post<Stop>("/api/routes/stops", data),

  students: () => request<Student[]>("/api/students/"),
  createStudent: (data: {
    full_name: string;
    grade: string;
    school: string;
    guardian_id: number | null;
    route_id: number | null;
    stop_id: number | null;
    qr_code: string | null;
  }) => post<Student>("/api/students/", data),

  trips: () => request<Trip[]>("/api/trips/"),
  createTrip: (data: { route_id: number; driver_id: number | null }) => post<Trip>("/api/trips/", data),
  startTrip: (tripId: number) => post<Trip>(`/api/trips/${tripId}/start`),
  finishTrip: (tripId: number) => post<Trip>(`/api/trips/${tripId}/finish`),

  history: (studentId: number) => request<AttendanceEvent[]>(`/api/attendance/student/${studentId}`),
  registerEvent: (data: {
    student_id: number;
    trip_id: number;
    stop_id: number | null;
    event_type: EventType;
    method: CheckInMethod;
  }) => post<AttendanceEvent>("/api/attendance/", data),
  scanQr: (data: { qr_code: string; trip_id: number; stop_id: number | null; event_type: EventType }) =>
    post<AttendanceEvent>("/api/attendance/scan", data),

  predictDelay: (data: {
    weather: string;
    road_condition: string;
    historical_delay_minutes: number;
    stops_remaining: number;
  }) => post<DelayPrediction>("/api/ai/delay", data),
};

// Loads the stops of every route in parallel: { routeId: Stop[] }.
export async function loadAllStops(routes: Route[]): Promise<Record<number, Stop[]>> {
  const entries = await Promise.all(routes.map(async (route) => [route.id, await api.stops(route.id)] as const));
  return Object.fromEntries(entries);
}

// Loads the attendance history of several students in parallel: { studentId: events }.
export async function loadHistories(studentIds: number[]): Promise<Record<number, AttendanceEvent[]>> {
  const entries = await Promise.all(studentIds.map(async (id) => [id, await api.history(id)] as const));
  return Object.fromEntries(entries);
}
