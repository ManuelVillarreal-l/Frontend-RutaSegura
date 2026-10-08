// Data shapes returned by the RutaSegura API.

export type Role = "guardian" | "driver" | "monitor" | "coordinator";
export type TripStatus = "scheduled" | "in_progress" | "finished";
export type EventType = "boarding" | "drop_off";
export type CheckInMethod = "qr" | "manual";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface Route {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Stop {
  id: number;
  route_id: number;
  name: string;
  order: number;
  latitude: number | null;
  longitude: number | null;
}

export interface Student {
  id: number;
  full_name: string;
  grade: string;
  school: string;
  guardian_id: number | null;
  route_id: number | null;
  stop_id: number | null;
  qr_code: string;
  active: boolean;
}

export interface Trip {
  id: number;
  route_id: number;
  driver_id: number | null;
  status: TripStatus;
  started_at: string | null;
  finished_at: string | null;
}

export interface AttendanceEvent {
  id: number;
  student_id: number;
  trip_id: number;
  stop_id: number | null;
  event_type: EventType;
  method: CheckInMethod;
  timestamp: string;
}

export interface DelayPrediction {
  estimated_delay_minutes: number;
  risk: "low" | "medium" | "high";
  factors: string[];
}
