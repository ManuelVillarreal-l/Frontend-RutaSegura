// Guardian screen: where each child is, the bus on the map in real time, the
// estimated arrival time to the child's stop and the attendance history.

import { useMemo, useState } from "react";
import { api } from "../../api";
import { RiskPill } from "../../components/Charts";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { MapView } from "../../components/MapView";
import { QrImage } from "../../components/QrCard";
import { RouteLine } from "../../components/RouteLine";
import { DIRECTION_LABEL, formatDay, formatTime, localDateKey, minutesAgo, parseUtc, RISK_LABEL, todayKey } from "../../format";
import { useInterval, useLoad } from "../../hooks";
import type { AttendanceEvent, Route, Stop, Student, Trip } from "../../types";

const LIVE_MS = 15_000;

export function GuardianHome() {
  const base = useLoad(async () => {
    const [students, trips, routes] = await Promise.all([api.students(), api.trips(), api.routes()]);
    const routeIds = [...new Set(students.map((s) => s.route_id).filter((id): id is number => id !== null))];
    const stopLists = await Promise.all(routeIds.map((id) => api.stops(id)));
    const stopsByRoute = Object.fromEntries(routeIds.map((id, i) => [id, stopLists[i]])) as Record<number, Stop[]>;
    return { students, trips, routes, stopsByRoute };
  }, []);

  useInterval(() => void base.reload(true), 60_000);

  if (base.loading && !base.data) return <Loading />;
  if (base.error || !base.data) return <ErrorBox message={base.error ?? "Error"} onRetry={base.reload} />;

  const { students, trips, routes, stopsByRoute } = base.data;
  if (students.length === 0) {
    return (
      <>
        <PageHeader title="Mis hijos" />
        <Notice>No tiene estudiantes asociados. Comuníquese con el coordinador del colegio.</Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Mis hijos" />
      <div className="children">
        {students.map((student) => (
          <ChildCard
            key={student.id}
            student={student}
            route={routes.find((r) => r.id === student.route_id)}
            stops={student.route_id ? stopsByRoute[student.route_id] ?? [] : []}
            trips={trips.filter((t) => t.route_id === student.route_id)}
          />
        ))}
      </div>
    </>
  );
}

function ChildCard({ student, route, stops, trips }: { student: Student; route?: Route; stops: Stop[]; trips: Trip[] }) {
  const history = useLoad(() => api.history(student.id, 40), [student.id]);
  const risk = useLoad(() => api.absenceRisk(student.id), [student.id]);
  const [showCard, setShowCard] = useState(false);

  const live = trips.find((t) => t.status.code === "in_progress") ?? null;
  const todays = trips.filter((t) => t.scheduled_date === todayKey());
  useInterval(() => void history.reload(true), LIVE_MS, Boolean(live));

  const stop = stops.find((s) => s.id === student.stop_id);
  const events = history.data ?? [];
  const status = childStatus(student, events, live, todays);

  return (
    <article className="child">
      <header className="child-head">
        <h2>{student.full_name}</h2>
        <p className="muted">
          {student.grade.name} · {route?.name ?? "Sin ruta"} · Parada: {stop?.name ?? "—"}
        </p>
      </header>
      <p className={`child-status tone-${status.tone}`} role="status">
        {status.text}
      </p>

      {live && stop && <LiveBus trip={live} stops={stops} stop={stop} />}

      <div className="child-body">
        <section>
          <h3>Ruta</h3>
          <RouteLine stops={stops} highlightStopId={student.stop_id} busStopId={lastStopOfTrip(events, live)} />
        </section>
        <section>
          <h3>Historial</h3>
          {history.loading && !history.data ? <Loading /> : <History events={events} stops={stops} />}
        </section>
        <section>
          <h3>Asistencia</h3>
          {risk.data && (
            <div className="risk-box">
              <p>
                <RiskPill risk={risk.data.risk} label={`Riesgo de inasistencia ${RISK_LABEL[risk.data.risk].toLowerCase()}`} />
              </p>
              <p className="muted">{risk.data.explanation}</p>
            </div>
          )}
          <button type="button" className="button button-quiet" onClick={() => setShowCard((v) => !v)}>
            {showCard ? "Ocultar carnet" : "Ver código QR del carnet"}
          </button>
          {showCard && (
            <div className="qr-preview">
              <QrImage code={student.qr_code} size={150} />
              <code>{student.qr_code}</code>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

// Bus on the map with its GPS trail and the estimated time to the child's stop.
function LiveBus({ trip, stops, stop }: { trip: Trip; stops: Stop[]; stop: Stop }) {
  const live = useLoad(async () => {
    const [trail, eta] = await Promise.all([
      api.trail(trip.id).catch(() => []),
      api.eta(trip.id, stop.id).catch(() => null),
    ]);
    return { trail, eta };
  }, [trip.id, stop.id]);
  useInterval(() => void live.reload(true), LIVE_MS);

  const trail = live.data?.trail ?? [];
  const last = trail[trail.length - 1] ?? null;
  const eta = live.data?.eta;
  const mapStops = useMemo(
    () => stops.map((s, i) => ({ ...s, highlight: s.id === stop.id, isSchool: i === stops.length - 1 })),
    [stops, stop.id],
  );

  return (
    <div className="live-bus">
      <div className="live-bus-info">
        <span className="live-dot" aria-hidden="true" />
        <strong>{DIRECTION_LABEL[trip.direction]} en curso</strong>
        {last ? (
          <span className="muted">
            Bus visto {minutesAgo(last.recorded_at)}
            {last.speed_kmh ? ` · ${Math.round(last.speed_kmh)} km/h` : ""}
          </span>
        ) : (
          <span className="muted">Esperando la ubicación del bus…</span>
        )}
        {eta && (
          <span className="eta">
            Llega a {eta.stop_name} en <strong>~{eta.eta_minutes} min</strong> ({eta.distance_km} km)
          </span>
        )}
      </div>
      <MapView
        height={240}
        stops={mapStops}
        trail={trail.map((p) => [p.latitude, p.longitude] as [number, number])}
        buses={last ? [{ id: trip.id, latitude: last.latitude, longitude: last.longitude, label: "Bus escolar" }] : []}
        label="Mapa con la ubicación del bus escolar en tiempo real"
      />
    </div>
  );
}

function lastStopOfTrip(events: AttendanceEvent[], live: Trip | null): number | null {
  if (!live) return null;
  return events.filter((e) => e.trip_id === live.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.stop_id ?? null;
}

function childStatus(
  student: Student,
  events: AttendanceEvent[],
  live: Trip | null,
  todays: Trip[],
): { tone: "idle" | "moving" | "arrived"; text: string } {
  const first = student.first_name;
  const todayEvents = events
    .filter((e) => localDateKey(parseUtc(e.timestamp)) === todayKey())
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = todayEvents[0];
  if (latest?.event_type.code === "boarding") {
    return { tone: "moving", text: `${first} va en el bus desde las ${formatTime(latest.timestamp)}` };
  }
  if (latest?.event_type.code === "drop_off") {
    const trip = todays.find((t) => t.id === latest.trip_id);
    const where = trip?.direction === "return" ? "llegó a su parada" : "llegó al colegio";
    return { tone: "arrived", text: `${first} ${where} a las ${formatTime(latest.timestamp)}` };
  }
  if (live) return { tone: "moving", text: `El bus ya salió. ${first} todavía no ha subido.` };
  if (todays.some((t) => t.status.code === "scheduled")) {
    return { tone: "idle", text: `Hoy hay recorrido programado. ${first} aún no ha subido al bus.` };
  }
  return { tone: "idle", text: `Sin movimientos de ${first} hoy.` };
}

function History({ events, stops }: { events: AttendanceEvent[]; stops: Stop[] }) {
  const [all, setAll] = useState(false);
  if (events.length === 0) return <p className="muted">Todavía no hay registros.</p>;
  const days = new Map<string, AttendanceEvent[]>();
  for (const event of events.slice(0, all ? 40 : 6)) {
    const key = localDateKey(parseUtc(event.timestamp));
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return (
    <>
      {[...days.entries()].map(([key, list]) => (
        <div key={key} className="history-day">
          <h4>{formatDay(list[0].timestamp)}</h4>
          <ul className="history">
            {list.map((event) => (
              <li key={event.id} className="history-item">
                <time>{formatTime(event.timestamp)}</time>
                <span>
                  {event.event_type.name}
                  <small>
                    {stops.find((s) => s.id === event.stop_id)?.name ?? "—"} · {event.method.name}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {events.length > 6 && (
        <button type="button" className="button button-quiet" onClick={() => setAll((v) => !v)}>
          {all ? "Ver menos" : "Ver historial completo"}
        </button>
      )}
    </>
  );
}
