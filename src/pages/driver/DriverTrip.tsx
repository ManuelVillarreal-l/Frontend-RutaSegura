// Driver / monitor screen: start the trip with the weather and road from the catalogs,
// share the bus GPS, read ID cards with the camera, register boardings (also without
// internet), undo mistakes, report incidents and finish the trip.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, ApiError, newEventId } from "../../api";
import { useCatalog, useCurrentUser } from "../../auth";
import { RiskPill } from "../../components/Charts";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { SelectField, TextField } from "../../components/Fields";
import { MapView } from "../../components/MapView";
import { QrScanner } from "../../components/QrScanner";
import { RouteLine } from "../../components/RouteLine";
import { DIRECTION_LABEL, formatPlainDate, formatTime, localHour, RISK_LABEL, todayKey } from "../../format";
import { getPositionOnce, useGps, useInterval, useLoad, useOfflineQueue } from "../../hooks";
import type { AttendanceEvent, DelayPrediction, Route, Stop, Student, Trip } from "../../types";
import { check, RULES } from "../../validation";

type StudentState = "pending" | "on_board" | "delivered";
type Message = { kind: "success" | "error" | "info"; text: string } | null;

const GPS_SEND_MS = 15_000;

export function DriverTrip() {
  const user = useCurrentUser();

  const base = useLoad(async () => {
    const [trips, routes, students] = await Promise.all([api.trips(), api.routes(), api.students()]);
    const routeIds = [...new Set(trips.map((t) => t.route_id))];
    const stopLists = await Promise.all(routeIds.map((id) => api.stops(id)));
    const stopsByRoute = Object.fromEntries(routeIds.map((id, i) => [id, stopLists[i]])) as Record<number, Stop[]>;
    return { trips, routes, students, stopsByRoute };
  }, []);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (base.loading && !base.data) return <Loading />;
  if (base.error || !base.data) return <ErrorBox message={base.error ?? "Error"} onRetry={base.reload} />;

  const { trips, routes } = base.data;
  const active = trips
    .filter((t) => t.status.code !== "finished" && (t.driver_id === user.id || t.monitor_id === user.id))
    .filter((t) => t.status.code === "in_progress" || t.scheduled_date >= todayKey())
    .sort((a, b) => rank(a) - rank(b) || a.scheduled_date.localeCompare(b.scheduled_date) || a.id - b.id);

  const selected = active.find((t) => t.id === selectedId) ?? active[0] ?? null;
  const route = (id: number) => routes.find((r) => r.id === id);

  return (
    <>
      <PageHeader title={user.role.code === "driver" ? "Mi recorrido" : "Recorrido en curso"} />

      {active.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Recorridos">
          {active.map((trip) => (
            <button
              key={trip.id}
              type="button"
              role="tab"
              aria-selected={trip.id === selected?.id}
              className="segmented-item"
              onClick={() => setSelectedId(trip.id)}
            >
              {route(trip.route_id)?.name ?? `Ruta ${trip.route_id}`}
              <small>
                {formatPlainDate(trip.scheduled_date)} · {DIRECTION_LABEL[trip.direction]} · {trip.status.name}
              </small>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <TripPanel
          key={selected.id}
          trip={selected}
          route={route(selected.route_id)}
          stops={base.data.stopsByRoute[selected.route_id] ?? []}
          students={base.data.students.filter((s) => s.route_id === selected.route_id && s.active)}
          onChanged={() => base.reload(true)}
        />
      ) : (
        <Notice>No tiene recorridos asignados para hoy. El coordinador los programa en la sección Recorridos.</Notice>
      )}
    </>
  );
}

function rank(trip: Trip) {
  return trip.status.code === "in_progress" ? 0 : 1;
}

// ---------------------------------------------------------------------------

function TripPanel({
  trip,
  route,
  stops,
  students,
  onChanged,
}: {
  trip: Trip;
  route: Route | undefined;
  stops: Stop[];
  students: Student[];
  onChanged: () => Promise<void> | void;
}) {
  const inProgress = trip.status.code === "in_progress";
  const events = useLoad(() => api.tripEvents(trip.id), [trip.id]);
  const queue = useLoad(() => (inProgress ? api.queue(trip.id) : Promise.resolve(null)), [trip.id, inProgress]);
  const offline = useOfflineQueue(() => {
    void events.reload(true);
    void queue.reload(true);
  });

  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sharing, setSharing] = useState(true);
  const gps = useGps(inProgress && sharing);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);

  // Ordered stops for this direction (return trips start at the school).
  const ordered = useMemo(() => (trip.direction === "return" ? [...stops].reverse() : stops), [stops, trip.direction]);
  const school = stops[stops.length - 1] ?? null;

  // Pending offline events of this trip also count for the student state.
  const allEvents: { student_id: number; type: string; at: string }[] = useMemo(
    () => [
      ...(events.data ?? []).map((e: AttendanceEvent) => ({ student_id: e.student_id, type: e.event_type.code, at: e.timestamp })),
      ...offline.events
        .filter((e) => e.trip_id === trip.id)
        .map((e) => ({ student_id: e.student_id, type: e.event_type_code, at: e.occurred_at })),
    ],
    [events.data, offline.events, trip.id],
  );

  const stateOf = useMemo(() => {
    const states = new Map<number, StudentState>();
    for (const event of [...allEvents].sort((a, b) => a.at.localeCompare(b.at))) {
      states.set(event.student_id, event.type === "boarding" ? "on_board" : "delivered");
    }
    return (id: number): StudentState => states.get(id) ?? "pending";
  }, [allEvents]);

  const counts = {
    pending: students.filter((s) => stateOf(s.id) === "pending").length,
    onBoard: students.filter((s) => stateOf(s.id) === "on_board").length,
    delivered: students.filter((s) => stateOf(s.id) === "delivered").length,
  };

  // Last stop where something happened, to place the bus on the route line.
  const busStopId = useMemo(() => {
    if (!inProgress) return null;
    const latest = [...(events.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    return latest?.stop_id ?? ordered[0]?.id ?? null;
  }, [events.data, inProgress, ordered]);

  // ---------------- GPS: send the position every 15 seconds ----------------
  const lastSent = useRef(0);
  useEffect(() => {
    const fix = gps.fix;
    if (!inProgress || !fix) return;
    setTrail((t) => [...t.slice(-200), [fix.latitude, fix.longitude]]);
    if (Date.now() - lastSent.current < GPS_SEND_MS || !navigator.onLine) return;
    lastSent.current = Date.now();
    api
      .sendLocation(trip.id, {
        latitude: fix.latitude,
        longitude: fix.longitude,
        speed_kmh: fix.speed_kmh,
        accuracy_m: fix.accuracy_m,
      })
      .then((r) =>
        setGpsStatus(
          r.approach_notifications > 0
            ? `Ubicación enviada. Se avisó a ${r.approach_notifications} acudiente(s) que el bus se acerca.`
            : `Ubicación enviada a las ${new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}.`,
        ),
      )
      .catch((err) => setGpsStatus(err instanceof Error ? err.message : "No se pudo enviar la ubicación."));
  }, [gps.fix, inProgress, trip.id]);

  useInterval(() => void queue.reload(true), 20_000, inProgress);

  // ---------------- Actions ----------------
  async function refresh() {
    await Promise.all([events.reload(true), queue.reload(true)]);
  }

  function position() {
    return gps.fix ? { latitude: gps.fix.latitude, longitude: gps.fix.longitude } : { latitude: null, longitude: null };
  }

  function saveOffline(student: Student, eventType: "boarding" | "drop_off", method: "qr" | "manual", id: string) {
    offline.add({
      client_event_id: id,
      trip_id: trip.id,
      student_id: student.id,
      event_type_code: eventType,
      method_code: method,
      occurred_at: new Date().toISOString(),
      ...position(),
    });
    setMessage({
      kind: "info",
      text: `Sin internet: ${student.full_name} quedó guardado en el teléfono y se enviará al volver la señal.`,
    });
  }

  async function register(student: Student, eventType: "boarding" | "drop_off", method: "qr" | "manual") {
    const id = newEventId();
    if (!navigator.onLine) {
      saveOffline(student, eventType, method, id);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (method === "qr") {
        await api.scan({ qr_code: student.qr_code, trip_id: trip.id, client_event_id: id, ...position() });
      } else {
        await api.registerEvent({
          student_id: student.id,
          trip_id: trip.id,
          event_type_code: eventType,
          method_code: "manual",
          client_event_id: id,
          ...position(),
        });
      }
      await refresh();
      setMessage({ kind: "success", text: `${student.full_name}: ${eventType === "boarding" ? "subió al bus" : "bajó del bus"}.` });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) saveOffline(student, eventType, method, id);
      else setMessage({ kind: "error", text: err instanceof Error ? err.message : "No se pudo registrar." });
    } finally {
      setBusy(false);
    }
  }

  function onCode(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const student = students.find((s) => s.qr_code === code);
    if (!student) {
      setMessage({ kind: "error", text: `El carnet ${code} no pertenece a un estudiante de esta ruta.` });
      return;
    }
    const state = stateOf(student.id);
    if (state === "delivered") {
      setMessage({ kind: "error", text: `${student.full_name} ya terminó este recorrido.` });
      return;
    }
    void register(student, state === "pending" ? "boarding" : "drop_off", "qr");
  }

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "success", text: success });
      await refresh();
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "No se pudo completar la acción." });
    } finally {
      setBusy(false);
    }
  }

  const tripStops = ordered;
  const boardingStopOf = (s: Student) => (trip.direction === "outbound" ? s.stop_id : school?.id);
  const dropStopOf = (s: Student) => (trip.direction === "outbound" ? school?.id : s.stop_id);

  return (
    <section className="trip">
      <div className="trip-head">
        <div>
          <h2>{route?.name ?? `Ruta ${trip.route_id}`}</h2>
          <p className="muted">
            Recorrido #{trip.id} · {DIRECTION_LABEL[trip.direction]} · {formatPlainDate(trip.scheduled_date)}
            {trip.started_at ? ` · iniciado a las ${formatTime(trip.started_at)}` : ""}
          </p>
          {trip.weather && (
            <p className="muted">
              Clima: {trip.weather.name} · Vía: {trip.road_condition?.name}
            </p>
          )}
        </div>
        <span className={`status status-${trip.status.code}`}>{trip.status.name}</span>
      </div>

      {trip.status.code === "scheduled" && (
        <StartTrip trip={trip} stops={stops} onStarted={onChanged} />
      )}

      {inProgress && (
        <>
          {!offline.online && (
            <Notice kind="error">Sin conexión a internet. Los registros se guardan en el teléfono.</Notice>
          )}
          {offline.events.length > 0 && (
            <Notice>
              <p>
                {offline.events.length} registro(s) pendiente(s) por enviar.{" "}
                <button type="button" className="button button-quiet" disabled={offline.syncing} onClick={() => void offline.sync()}>
                  {offline.syncing ? "Sincronizando…" : "Sincronizar ahora"}
                </button>
              </p>
            </Notice>
          )}
          {offline.lastResult && <p className="muted">{offline.lastResult}</p>}

          <div className="gps-bar">
            <label className="switch">
              <input type="checkbox" checked={sharing} onChange={(e) => setSharing(e.target.checked)} />
              <span>Compartir ubicación del bus</span>
            </label>
            <small className="muted">
              {gps.error ??
                (gps.fix
                  ? `GPS ±${gps.fix.accuracy_m ?? "?"} m${gps.fix.speed_kmh !== null ? ` · ${gps.fix.speed_kmh} km/h` : ""}`
                  : sharing
                    ? "Buscando señal GPS…"
                    : "Ubicación desactivada")}
            </small>
            {gpsStatus && <small className="muted">{gpsStatus}</small>}
          </div>

          <MapView
            height={260}
            stops={tripStops.map((s) => ({ ...s, isSchool: s.id === school?.id }))}
            buses={gps.fix ? [{ id: "me", latitude: gps.fix.latitude, longitude: gps.fix.longitude, label: "Bus" }] : []}
            trail={trail}
          />

          {scanning ? (
            <QrScanner onCode={onCode} onClose={() => setScanning(false)} />
          ) : (
            <button type="button" className="button button-primary button-big" onClick={() => setScanning(true)}>
              <CameraIcon /> Escanear carnet con la cámara
            </button>
          )}
          <ManualQr onCode={onCode} disabled={busy} />

          {queue.data?.next && (
            <p className="next-up">
              <strong>Siguiente:</strong> {queue.data.next.full_name} en {queue.data.next.stop}
              <small className="muted"> ({queue.data.pending} por recoger · cola de abordaje)</small>
            </p>
          )}

          <p className="trip-counts">
            <span>
              <strong>{counts.pending}</strong> por recoger
            </span>
            <span>
              <strong>{counts.onBoard}</strong> a bordo
            </span>
            <span>
              <strong>{counts.delivered}</strong> entregados
            </span>
          </p>
        </>
      )}

      {message && <Notice kind={message.kind === "info" ? "info" : message.kind}>{message.text}</Notice>}
      {events.error && <ErrorBox message={events.error} onRetry={() => void events.reload()} />}

      <RouteLine
        stops={tripStops}
        busStopId={busStopId}
        renderStop={(stop) => {
          const here = students.filter((s) => {
            const state = stateOf(s.id);
            if (stop.id === boardingStopOf(s)) return state === "pending" || stop.id !== dropStopOf(s);
            if (stop.id === dropStopOf(s)) return state !== "pending";
            return false;
          });
          if (here.length === 0) return null;
          return (
            <ul className="stop-students">
              {here.map((student) => {
                const state = stateOf(student.id);
                const atBoarding = stop.id === boardingStopOf(student);
                const showBoard = inProgress && atBoarding && state === "pending";
                const showDrop = inProgress && stop.id === dropStopOf(student) && state === "on_board";
                return (
                  <li key={`${stop.id}-${student.id}`} className={`stop-student is-${state}`}>
                    <span>
                      {student.full_name}
                      <small>{STATE_LABEL[state]}</small>
                    </span>
                    {showBoard && (
                      <button type="button" className="button button-primary" disabled={busy} onClick={() => void register(student, "boarding", "manual")}>
                        Subió
                      </button>
                    )}
                    {showDrop && (
                      <button type="button" className="button button-primary" disabled={busy} onClick={() => void register(student, "drop_off", "manual")}>
                        Bajó
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }}
      />

      {inProgress && (
        <div className="trip-tools">
          <button
            type="button"
            className="button button-quiet"
            disabled={busy || !navigator.onLine}
            onClick={() =>
              void act(async () => {
                await api.undo(trip.id);
              }, "Se deshizo el último registro.")
            }
          >
            ↶ Deshacer último registro
          </button>
          <IncidentForm tripId={trip.id} position={position} />
          <button
            type="button"
            className="button button-secondary button-big"
            disabled={busy || offline.events.length > 0}
            title={offline.events.length > 0 ? "Primero sincronice los registros pendientes" : undefined}
            onClick={() => void act(() => api.finishTrip(trip.id), "Recorrido finalizado.")}
          >
            Finalizar recorrido
          </button>
          {counts.onBoard > 0 && (
            <small className="muted">
              No se puede finalizar con {counts.onBoard} estudiante(s) a bordo: registre su descenso primero.
            </small>
          )}
        </div>
      )}
    </section>
  );
}

const STATE_LABEL: Record<StudentState, string> = {
  pending: "Por recoger",
  on_board: "A bordo",
  delivered: "Entregado",
};

// ---------------------------------------------------------------------------
// Start: weather and road come from the database catalogs; the weather can be
// detected automatically and the AI shows the expected delay before leaving.
// ---------------------------------------------------------------------------

function StartTrip({ trip, stops, onStarted }: { trip: Trip; stops: Stop[]; onStarted: () => Promise<void> | void }) {
  const weathers = useCatalog("weather_conditions");
  const roads = useCatalog("road_conditions");
  const [weather, setWeather] = useState("");
  const [road, setRoad] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<DelayPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isToday = trip.scheduled_date === todayKey();

  useEffect(() => {
    if (!weather || !road) {
      setPrediction(null);
      return;
    }
    api
      .predictDelay({
        route_id: trip.route_id,
        weather_code: weather,
        road_condition_code: road,
        stops_remaining: Math.max(stops.length - 1, 0),
        hour: localHour(),
      })
      .then(setPrediction)
      .catch(() => setPrediction(null));
  }, [weather, road, trip.route_id, stops.length]);

  async function detect() {
    setDetecting(true);
    setError(null);
    try {
      const fallback = stops[0];
      const where = await getPositionOnce().catch(() =>
        fallback ? { latitude: fallback.latitude, longitude: fallback.longitude } : Promise.reject(new Error("Sin ubicación")),
      );
      const current = await api.currentWeather(where.latitude, where.longitude);
      if (current.condition) setWeather(current.condition.code);
      setDetected(
        `${current.condition?.name ?? "Clima sin equivalencia en el catálogo"} · ${current.temperature_c ?? "?"} °C · lluvia ${current.precipitation_mm ?? 0} mm (${current.source})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo detectar el clima.");
    } finally {
      setDetecting(false);
    }
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.startTrip(trip.id, weather, road);
      await onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={start}>
      <h3>Antes de salir</h3>
      <div className="form-grid">
        <SelectField
          label="Clima"
          value={weather}
          onChange={setWeather}
          placeholder="Seleccione…"
          options={weathers.map((w) => ({ value: w.code, label: `${w.name} (+${w.delay_minutes} min)` }))}
        />
        <SelectField
          label="Estado de la vía"
          value={road}
          onChange={setRoad}
          placeholder="Seleccione…"
          options={roads.map((r) => ({ value: r.code, label: `${r.name} (+${r.delay_minutes} min)` }))}
        />
      </div>
      <div className="button-row">
        <button type="button" className="button button-quiet" disabled={detecting} onClick={() => void detect()}>
          {detecting ? "Consultando el clima…" : "Detectar clima con el GPS"}
        </button>
      </div>
      {detected && <p className="muted">Clima actual: {detected}</p>}
      {prediction && (
        <div className={`prediction-inline risk-${prediction.risk}`}>
          <strong>IA: {prediction.estimated_delay_minutes} min de retraso estimado</strong>{" "}
          <RiskPill risk={prediction.risk} label={`Riesgo ${RISK_LABEL[prediction.risk].toLowerCase()}`} />
          <small className="muted">
            {" "}
            {prediction.model === "regression"
              ? `Regresión lineal con ${prediction.training_samples} recorridos reales`
              : "Valores del catálogo"}
          </small>
        </div>
      )}
      {!isToday && <p className="muted">Este recorrido es para el {formatPlainDate(trip.scheduled_date)}.</p>}
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary button-big" disabled={busy || !weather || !road}>
        {busy ? "Iniciando…" : "Iniciar recorrido"}
      </button>
      <small className="muted">Al iniciar, los acudientes reciben un aviso.</small>
    </form>
  );
}

// ---------------------------------------------------------------------------

function ManualQr({ onCode, disabled }: { onCode: (code: string) => void; disabled: boolean }) {
  const [code, setCode] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <form
      className="qr-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (check(RULES.qr, code)) return;
        onCode(code);
        setCode("");
        setTried(false);
      }}
    >
      <TextField
        label="O escriba el código del carnet"
        rule={RULES.qr}
        value={code}
        onChange={setCode}
        placeholder="RS-DEMO-0001"
        autoComplete="off"
        autoCapitalize="characters"
        showErrors={tried}
      />
      <button type="submit" className="button button-primary" disabled={disabled}>
        Registrar
      </button>
    </form>
  );
}

function IncidentForm({
  tripId,
  position,
}: {
  tripId: number;
  position: () => { latitude: number | null; longitude: number | null };
}) {
  const types = useCatalog("incident_types");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [tried, setTried] = useState(false);
  const [result, setResult] = useState<Message>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!type || check(RULES.freeText, description)) return;
    try {
      await api.reportIncident({ trip_id: tripId, incident_type_code: type, description, ...position() });
      setResult({ kind: "success", text: "Incidente reportado. El coordinador ya fue avisado." });
      setDescription("");
      setType("");
      setTried(false);
      setOpen(false);
    } catch (err) {
      setResult({ kind: "error", text: err instanceof Error ? err.message : "No se pudo reportar." });
    }
  }

  return (
    <div className="incident">
      {result && <Notice kind={result.kind === "info" ? "info" : result.kind}>{result.text}</Notice>}
      {open ? (
        <form className="panel form" onSubmit={send} noValidate>
          <h3>Reportar incidente</h3>
          <SelectField
            label="Tipo"
            value={type}
            onChange={setType}
            placeholder="Seleccione…"
            options={types.map((t) => ({ value: t.code, label: t.name }))}
          />
          <TextField
            label="¿Qué pasó?"
            rule={RULES.freeText}
            value={description}
            onChange={setDescription}
            showErrors={tried}
            placeholder="Ej.: derrumbe en la vía después de la vereda El Puerto"
          />
          <div className="button-row">
            <button type="submit" className="button button-danger">
              Enviar reporte
            </button>
            <button type="button" className="button button-quiet" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button button-quiet" onClick={() => setOpen(true)}>
          ⚠ Reportar incidente
        </button>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

