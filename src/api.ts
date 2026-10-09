// HTTP client for the RutaSegura API. Messages shown to the user are in Spanish.

import { passwordDigest } from "./crypto";
import type {
  AbsenceRisk,
  AttendanceEvent,
  AuditEntry,
  BoardingQueue,
  BusLocation,
  CatalogItem,
  CatalogName,
  Catalogs,
  CurrentWeather,
  DelayPrediction,
  Driver,
  Eta,
  Incident,
  Itinerary,
  Notification,
  Person,
  Route,
  RouteOptimization,
  School,
  Segment,
  ShortestPath,
  Stop,
  StructureInfo,
  Student,
  Summary,
  SyncResult,
  TreeNode,
  Trip,
  User,
  Vehicle,
} from "./types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "https://rutasegura-api-g7n4.onrender.com").replace(/\/$/, "");

const TOKEN_KEY = "rutasegura.token";
const SLOW_REQUEST_MS = 4000;

// ---------- Token storage (sessionStorage: closing the tab ends the session) ----------

export function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return memoryToken;
  }
}

let memoryToken: string | null = null;

export function saveToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the token stays in memory only.
  }
}

// Expiration time (ms) written inside the JWT ("exp" claim). The token is not secret
// to its owner; we only read it to show the countdown. The server checks the signature.
export function tokenExpiry(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")));
    return typeof data.exp === "number" ? data.exp * 1000 : null;
  } catch {
    return null;
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

let unauthorizedHandler: ((message: string) => void) | null = null;
export function onUnauthorized(handler: (message: string) => void) {
  unauthorizedHandler = handler;
}

const FIELD_LABELS: Record<string, string> = {
  email: "Correo",
  password: "Contraseña",
  first_name: "Nombres",
  last_name: "Apellidos",
  phone: "Celular",
  document_number: "Documento",
  name: "Nombre",
  plate: "Placa",
  description: "Descripción",
  birth_date: "Fecha de nacimiento",
  code: "Código",
  delay_minutes: "Minutos de retraso",
  qr_code: "Código QR",
};

function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : "";
        const label = FIELD_LABELS[field] ?? "";
        return label ? `${label}: ${item.msg}` : item.msg;
      })
      .join(" ");
  }
  if (status === 0) return "No se pudo conectar con el servidor. Revise su conexión a internet.";
  if (status === 413) return "La información enviada es demasiado grande.";
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
    const message = errorMessage(response.status, body);
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler(message);
    throw new ApiError(response.status, message);
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });
const put = <T>(path: string, data: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data) });
const patch = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) });

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
}

// ---------- Endpoint inputs ----------

export interface NewUser {
  role_code: string;
  document_type_code: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string; // plain text here; hashed before sending
}

export interface NewStudent {
  document_type_code: string;
  document_number: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  grade_code: string;
  campus_id: number;
  route_id: number | null;
  stop_id: number | null;
  guardians: { guardian_id: number; relationship_code: string; is_primary: boolean }[];
}

export interface OfflineEvent {
  client_event_id: string;
  trip_id: number;
  student_id: number;
  event_type_code: string;
  method_code: string;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
}

// ---------- Endpoints ----------

export const api = {
  // Auth: the password is turned into a SHA-256 digest before it leaves the browser.
  login: async (email: string, password: string) =>
    post<{ access_token: string; token_type: string; expires_in: number }>("/api/auth/login", {
      email: email.trim().toLowerCase(),
      password: await passwordDigest(email, password),
    }),
  // Profile of the user who owns the token (used to choose the menu by role).
  profile: () => request<User>("/api/auth/profile"),

  // Users
  users: (role?: string) => request<User[]>(`/api/users/${query({ role })}`),
  createUser: async (data: NewUser) =>
    post<User>("/api/users/", { ...data, password: await passwordDigest(data.email, data.password) }),
  setUserActive: (id: number, active: boolean) => patch<User>(`/api/users/${id}/status`, { active }),
  drivers: () => request<Driver[]>("/api/users/drivers"),
  createDriver: (data: {
    user_id: number;
    license_number: string;
    license_category: string;
    license_expires_on: string;
    vehicle_id: number | null;
  }) => post<Driver>("/api/users/drivers", data),
  driverRotation: (driverUserId: number) =>
    request<{ current: Person; previous: Person; next: Person; ring: Person[] }>(
      `/api/users/drivers/rotation${query({ driver_user_id: driverUserId })}`,
    ),

  // Catalogs
  catalogs: () => request<Catalogs>("/api/catalogs/"),
  createCondition: (
    catalog: CatalogName,
    data: { code: string; name: string; delay_minutes: number; weather_codes?: string | null },
  ) => post<CatalogItem>(`/api/catalogs/${catalog}`, data),
  updateCondition: (
    catalog: CatalogName,
    id: number,
    data: { name?: string; delay_minutes?: number; weather_codes?: string | null; active?: boolean },
  ) => put<CatalogItem>(`/api/catalogs/${catalog}/${id}`, data),

  // Organization
  schools: () => request<School[]>("/api/schools"),
  schoolTree: () => request<{ total_leaves: number; tree: TreeNode }>("/api/schools/tree"),
  vehicles: () => request<Vehicle[]>("/api/vehicles"),
  createVehicle: (data: { plate: string; brand: string; model_year: number; capacity: number }) =>
    post<Vehicle>("/api/vehicles", data),

  // Routes
  routes: () => request<Route[]>("/api/routes/"),
  createRoute: (data: { name: string; description: string | null; campus_id: number; vehicle_id: number | null }) =>
    post<Route>("/api/routes/", data),
  stops: (routeId: number) => request<Stop[]>(`/api/routes/${routeId}/stops`),
  createStop: (data: { route_id: number; name: string; latitude: number; longitude: number }) =>
    post<Stop>("/api/routes/stops", data),
  segments: (routeId: number) => request<Segment[]>(`/api/routes/${routeId}/segments`),
  createSegment: (
    routeId: number,
    data: { from_stop_id: number; to_stop_id: number; distance_km: number; travel_minutes: number },
  ) => post<Segment>(`/api/routes/${routeId}/segments`, data),
  shortestPath: (routeId: number, from: number, to: number) =>
    request<ShortestPath>(`/api/routes/${routeId}/shortest-path${query({ from_stop_id: from, to_stop_id: to })}`),
  itinerary: (routeId: number, direction: "outbound" | "return") =>
    request<Itinerary>(`/api/routes/${routeId}/itinerary${query({ direction })}`),
  optimizeRoute: (routeId: number) => post<RouteOptimization>(`/api/routes/${routeId}/optimize`),

  // Students
  students: () => request<Student[]>("/api/students/"),
  searchStudents: (q: string) => request<Student[]>(`/api/students/search${query({ q })}`),
  createStudent: (data: NewStudent) => post<Student>("/api/students/", data),
  history: (studentId: number, limit = 30) =>
    request<AttendanceEvent[]>(`/api/students/${studentId}/history${query({ limit })}`),
  absenceRisk: (studentId: number) => request<AbsenceRisk>(`/api/students/${studentId}/absence-risk`),

  // Trips
  trips: (status?: string) => request<Trip[]>(`/api/trips/${query({ status })}`),
  createTrip: (data: {
    route_id: number;
    driver_id: number;
    monitor_id: number | null;
    vehicle_id: number | null;
    direction: "outbound" | "return";
    scheduled_date: string | null;
  }) => post<Trip>("/api/trips/", data),
  startTrip: (tripId: number, weather_code: string, road_condition_code: string) =>
    post<Trip>(`/api/trips/${tripId}/start`, { weather_code, road_condition_code }),
  finishTrip: (tripId: number) => post<Trip>(`/api/trips/${tripId}/finish`),
  tripEvents: (tripId: number) => request<AttendanceEvent[]>(`/api/trips/${tripId}/events`),
  queue: (tripId: number) => request<BoardingQueue>(`/api/trips/${tripId}/queue`),
  undo: (tripId: number) => post<AttendanceEvent>(`/api/trips/${tripId}/undo`),
  sendLocation: (
    tripId: number,
    data: { latitude: number; longitude: number; speed_kmh: number | null; accuracy_m: number | null },
  ) => post<{ saved: boolean; approach_notifications: number }>(`/api/trips/${tripId}/locations`, data),
  latestLocation: (tripId: number) => request<BusLocation>(`/api/trips/${tripId}/locations/latest`),
  trail: (tripId: number) => request<BusLocation[]>(`/api/trips/${tripId}/locations${query({ limit: 300 })}`),
  eta: (tripId: number, stopId: number) => request<Eta>(`/api/trips/${tripId}/eta${query({ stop_id: stopId })}`),
  monitorRotation: (days = 10) =>
    request<{ date: string; monitor: Person }[]>(`/api/trips/rotation/monitors${query({ days })}`),

  // Attendance
  registerEvent: (data: {
    student_id: number;
    trip_id: number;
    event_type_code: string;
    method_code: string;
    latitude: number | null;
    longitude: number | null;
    client_event_id: string;
  }) => post<AttendanceEvent>("/api/attendance/", data),
  scan: (data: {
    qr_code: string;
    trip_id: number;
    latitude: number | null;
    longitude: number | null;
    client_event_id: string;
  }) => post<AttendanceEvent>("/api/attendance/scan", data),
  sync: (events: OfflineEvent[]) => post<SyncResult>("/api/attendance/sync", { events }),

  // Monitoring
  reportIncident: (data: {
    trip_id: number | null;
    incident_type_code: string;
    description: string;
    latitude: number | null;
    longitude: number | null;
  }) => post<Incident>("/api/incidents", data),
  incidents: (openOnly = false) => request<Incident[]>(`/api/incidents${query({ open_only: openOnly })}`),
  resolveIncident: (id: number) => patch<Incident>(`/api/incidents/${id}/resolve`),
  notifications: (unreadOnly = false) =>
    request<Notification[]>(`/api/notifications${query({ unread_only: unreadOnly })}`),
  readAllNotifications: () => post<unknown>("/api/notifications/read-all"),
  summary: () => request<Summary>("/api/reports/summary"),
  audit: (limit = 100) => request<AuditEntry[]>(`/api/audit${query({ limit })}`),

  // Intelligence
  predictDelay: (data: {
    route_id: number | null;
    weather_code: string;
    road_condition_code: string;
    stops_remaining: number;
    hour: number;
  }) => post<DelayPrediction>("/api/ai/delay", data),
  currentWeather: (latitude: number, longitude: number) =>
    request<CurrentWeather>(`/api/ai/weather${query({ latitude, longitude })}`),
  structures: () => request<StructureInfo[]>("/api/structures"),
};

export function newEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function" && window.isSecureContext) return crypto.randomUUID();
  // Fallback UUID v4 for browsers without randomUUID (non-HTTPS).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
