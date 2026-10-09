// Reusable hooks: data loading, polling, GPS and the offline queue.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type OfflineEvent } from "./api";

// Runs an async loader and exposes { data, error, loading, reload }.
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        setData(await run());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      } finally {
        setLoading(false);
      }
    },
    [run],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

// Calls `callback` every `ms` milliseconds while `enabled` is true.
export function useInterval(callback: () => void, ms: number, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(timer);
  }, [ms, enabled]);
}

export interface GpsFix {
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  accuracy_m: number | null;
  at: number;
}

// Follows the device position while enabled (navigator.geolocation.watchPosition).
export function useGps(enabled: boolean) {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError("Este dispositivo no tiene GPS disponible en el navegador.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setError(null);
        setFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed_kmh: position.coords.speed !== null ? Math.round(position.coords.speed * 3.6 * 10) / 10 : null,
          accuracy_m: position.coords.accuracy !== null ? Math.round(position.coords.accuracy) : null,
          at: Date.now(),
        });
      },
      (err) =>
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación negado. Actívelo en el navegador para compartir la posición del bus."
            : "No se pudo obtener la ubicación. Revise que el GPS esté encendido.",
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix, error };
}

// Asks for the position once (used to detect the current weather).
export function getPositionOnce(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no tiene GPS disponible en el navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error("No se pudo obtener la ubicación.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  });
}

// ---------------------------------------------------------------------------
// Offline queue: events registered without internet are kept on the device and
// sent later with POST /api/attendance/sync (the server ignores duplicates).
// ---------------------------------------------------------------------------

const OFFLINE_KEY = "rutasegura.offline-events";

function readQueue(): OfflineEvent[] {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    const parsed = raw ? (JSON.parse(raw) as OfflineEvent[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(events: OfflineEvent[]) {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(events));
  } catch {
    // Storage blocked: events stay only in memory for this page.
  }
}

export function useOfflineQueue(onSynced?: () => void) {
  const [events, setEvents] = useState<OfflineEvent[]>(readQueue);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const synced = useRef(onSynced);
  synced.current = onSynced;

  const add = useCallback((event: OfflineEvent) => {
    setEvents((current) => {
      const next = [...current, event];
      writeQueue(next);
      return next;
    });
  }, []);

  const running = useRef(false);

  const sync = useCallback(async () => {
    const pending = readQueue();
    if (pending.length === 0 || running.current) return; // one sync at a time
    running.current = true;
    setSyncing(true);
    try {
      const result = await api.sync(pending.slice(0, 200));
      const sent = new Set(pending.slice(0, 200).map((e) => e.client_event_id));
      const rest = readQueue().filter((e) => !sent.has(e.client_event_id));
      writeQueue(rest);
      setEvents(rest);
      setLastResult(
        `Sincronizados: ${result.saved} nuevos` +
          (result.duplicated ? `, ${result.duplicated} ya estaban` : "") +
          (result.rejected.length ? `. Rechazados: ${result.rejected.join(" ")}` : "."),
      );
      synced.current?.();
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 0)) {
        setLastResult(err instanceof Error ? err.message : "No se pudo sincronizar.");
      }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      void sync();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    if (navigator.onLine) void sync();
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [sync]);

  return { events, online, syncing, lastResult, add, sync };
}
