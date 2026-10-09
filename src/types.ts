// Shapes returned by the RutaSegura API (v2).

export type RoleCode = "coordinator" | "driver" | "monitor" | "guardian";

export interface CatalogRef {
  id: number;
  code: string;
  name: string;
}

export interface CatalogItem extends CatalogRef {
  active: boolean;
  delay_minutes: number | null;
  weather_codes: string | null;
  severity: number | null;
  sort_order: number | null;
  description: string | null;
}

export type CatalogName =
  | "roles"
  | "document_types"
  | "relationships"
  | "grades"
  | "trip_statuses"
  | "event_types"
  | "check_in_methods"
  | "weather_conditions"
  | "road_conditions"
  | "incident_types";

export type Catalogs = Record<CatalogName, CatalogItem[]>;

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  role: CatalogRef & { code: RoleCode };
  document_type: CatalogRef;
  active: boolean;
  last_login_at: string | null;
}

export interface Driver {
  id: number;
  user_id: number;
  full_name: string;
  license_number: string;
  license_category: string;
  license_expires_on: string;
  license_valid: boolean;
  vehicle_plate: string | null;
}

export interface Person {
  user_id: number;
  full_name: string;
}

export interface Campus {
  id: number;
  school_id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface School {
  id: number;
  name: string;
  dane_code: string;
  municipality: string;
  phone: string | null;
  campuses: Campus[];
}

export interface Vehicle {
  id: number;
  plate: string;
  brand: string;
  model_year: number;
  capacity: number;
  active: boolean;
}

export interface Route {
  id: number;
  name: string;
  description: string | null;
  campus_id: number;
  vehicle_id: number | null;
  active: boolean;
}

export interface Stop {
  id: number;
  route_id: number;
  name: string;
  order: number;
  latitude: number;
  longitude: number;
}

export interface Segment {
  id: number;
  route_id: number;
  from_stop_id: number;
  to_stop_id: number;
  distance_km: number;
  travel_minutes: number;
}

export interface Guardian {
  guardian_id: number;
  full_name: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  document_number: string;
  document_type: CatalogRef;
  birth_date: string;
  grade: CatalogRef;
  campus_id: number;
  route_id: number | null;
  stop_id: number | null;
  qr_code: string;
  active: boolean;
  guardians: Guardian[];
}

export interface Trip {
  id: number;
  route_id: number;
  driver_id: number;
  monitor_id: number | null;
  vehicle_id: number | null;
  status: CatalogRef;
  weather: CatalogRef | null;
  road_condition: CatalogRef | null;
  direction: "outbound" | "return";
  scheduled_date: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface AttendanceEvent {
  id: number;
  student_id: number;
  trip_id: number;
  stop_id: number | null;
  event_type: CatalogRef;
  method: CatalogRef;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
}

export interface QueueItem {
  student_id: number;
  full_name: string;
  stop: string;
}

export interface BoardingQueue {
  pending: number;
  next: QueueItem | null;
  queue: QueueItem[];
}

export interface BusLocation {
  trip_id: number;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  accuracy_m: number | null;
  recorded_at: string;
}

export interface Eta {
  trip_id: number;
  stop_id: number;
  stop_name: string;
  distance_km: number;
  eta_minutes: number;
  speed_used_kmh: number;
  bus_location: BusLocation | null;
}

export interface Incident {
  id: number;
  trip_id: number | null;
  incident_type: CatalogRef;
  reported_by: number;
  description: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export type Risk = "low" | "medium" | "high";

export interface DelayPrediction {
  estimated_delay_minutes: number;
  risk: Risk;
  model: "regression" | "baseline";
  training_samples: number;
  r_squared: number | null;
  factors: string[];
}

export interface AbsenceRisk {
  student_id: number;
  trips_analyzed: number;
  absences: number;
  absence_rate: number;
  rainy_absence_rate: number | null;
  risk: Risk;
  explanation: string;
}

export interface RouteOptimization {
  route_id: number;
  original_order: string[];
  suggested_order: string[];
  original_km: number;
  suggested_km: number;
  saving_percent: number;
  method: string;
}

export interface CurrentWeather {
  temperature_c: number | null;
  precipitation_mm: number | null;
  wind_kmh: number | null;
  weather_code: number;
  condition: CatalogRef | null;
  source: string;
}

export interface ShortestPath {
  path: { id: number; name: string }[];
  distance_km: number;
  travel_minutes: number;
  algorithm: string;
}

export interface Itinerary {
  direction: "outbound" | "return";
  stops: { id: number; name: string; order: number }[];
}

export interface TreeNode {
  name: string;
  data: { type: string; id?: number };
  children: TreeNode[];
}

export interface Summary {
  students: number;
  routes: number;
  trips_in_progress: {
    trip_id: number;
    route_id: number;
    route_name: string;
    latitude: number | null;
    longitude: number | null;
    last_seen: string | null;
  }[];
  trips_scheduled: number;
  open_incidents: number;
  attendance_last_7_days: { date: string; assigned: number; boarded: number; rate: number | null }[];
}

export interface AuditEntry {
  id: number;
  user: string;
  action: string;
  entity: string;
  entity_id: number | null;
  detail: string | null;
  created_at: string;
}

export interface StructureInfo {
  name: string;
  file: string;
  complexity: string;
  use: string;
  endpoint: string;
}

export interface SyncResult {
  saved: number;
  duplicated: number;
  rejected: string[];
}
