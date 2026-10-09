// Trips: schedule a trip, list them and follow one live on the map.

import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useCatalog } from "../../auth";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { SelectField } from "../../components/Fields";
import { MapView } from "../../components/MapView";
import { DIRECTION_LABEL, formatPlainDate, formatTime, minutesAgo, todayKey } from "../../format";
import { useInterval, useLoad } from "../../hooks";
import type { Route, Trip, User, Vehicle } from "../../types";

export function Trips() {
  const statuses = useCatalog("trip_statuses");
  const [status, setStatus] = useState("");
  const [params, setParams] = useSearchParams();
  const following = Number(params.get("ver")) || null;

  const base = useLoad(async () => {
    const [routes, drivers, monitors, vehicles] = await Promise.all([
      api.routes(),
      api.users("driver"),
      api.users("monitor"),
      api.vehicles(),
    ]);
    return { routes, drivers, monitors, vehicles };
  }, []);
  const trips = useLoad(() => api.trips(status || undefined), [status]);
  useInterval(() => void trips.reload(true), 30_000);

  if (base.loading && !base.data) return <Loading />;
  if (base.error || !base.data) return <ErrorBox message={base.error ?? "Error"} onRetry={base.reload} />;
  const { routes, drivers, monitors, vehicles } = base.data;
  const routeName = (id: number) => routes.find((r) => r.id === id)?.name ?? `Ruta ${id}`;
  const person = (list: User[], id: number | null) => {
    const u = list.find((x) => x.id === id);
    return u ? `${u.first_name} ${u.last_name}` : "—";
  };
  const list = [...(trips.data ?? [])].sort(
    (a, b) => b.scheduled_date.localeCompare(a.scheduled_date) || b.id - a.id,
  );
  const followed = list.find((t) => t.id === following) ?? null;

  return (
    <>
      <PageHeader title="Recorridos" />
      <TripForm routes={routes} drivers={drivers} monitors={monitors} vehicles={vehicles} onCreated={() => trips.reload(true)} />

      {followed && (
        <LiveTrip trip={followed} routeName={routeName(followed.route_id)} onClose={() => setParams({})} />
      )}

      <div className="segmented" role="tablist" aria-label="Filtrar por estado">
        <button type="button" role="tab" aria-selected={status === ""} className="segmented-item" onClick={() => setStatus("")}>
          Todos
        </button>
        {statuses.map((s) => (
          <button key={s.code} type="button" role="tab" aria-selected={status === s.code} className="segmented-item" onClick={() => setStatus(s.code)}>
            {s.name}
          </button>
        ))}
      </div>

      {trips.error ? (
        <ErrorBox message={trips.error} onRetry={trips.reload} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ruta</th>
                <th>Conductor / monitor</th>
                <th>Clima y vía</th>
                <th>Horario</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 60).map((t) => (
                <tr key={t.id}>
                  <td>
                    {formatPlainDate(t.scheduled_date)}
                    <br />
                    <small className="muted">{DIRECTION_LABEL[t.direction]}</small>
                  </td>
                  <td>{routeName(t.route_id)}</td>
                  <td>
                    {person(drivers, t.driver_id)}
                    <br />
                    <small className="muted">{person(monitors, t.monitor_id)}</small>
                  </td>
                  <td>{t.weather ? `${t.weather.name} · ${t.road_condition?.name}` : "—"}</td>
                  <td>
                    {formatTime(t.started_at)} – {formatTime(t.finished_at)}
                  </td>
                  <td>
                    <span className={`status status-${t.status.code}`}>{t.status.name}</span>
                    {t.status.code === "in_progress" && (
                      <button type="button" className="link-button" onClick={() => setParams({ ver: String(t.id) })}>
                        Seguir en el mapa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="table-empty muted">No hay recorridos.</p>}
        </div>
      )}
    </>
  );
}

function LiveTrip({ trip, routeName, onClose }: { trip: Trip; routeName: string; onClose: () => void }) {
  const live = useLoad(async () => {
    const [stops, trail, events] = await Promise.all([
      api.stops(trip.route_id),
      api.trail(trip.id).catch(() => []),
      api.tripEvents(trip.id),
    ]);
    return { stops, trail, events };
  }, [trip.id]);
  useInterval(() => void live.reload(true), 15_000);

  const last = live.data?.trail[live.data.trail.length - 1];
  return (
    <section className="panel">
      <div className="detail-head">
        <h2>
          <span className="live-dot" aria-hidden="true" /> {routeName} en vivo
        </h2>
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className="muted">
        {last ? `Última posición ${minutesAgo(last.recorded_at)}${last.speed_kmh ? ` a ${Math.round(last.speed_kmh)} km/h` : ""}.` : "El bus todavía no envía su ubicación."}{" "}
        {live.data ? `${live.data.events.length} registros de abordaje/descenso.` : ""}
      </p>
      <MapView
        height={340}
        stops={(live.data?.stops ?? []).map((s, i, all) => ({ ...s, isSchool: i === all.length - 1 }))}
        trail={(live.data?.trail ?? []).map((p) => [p.latitude, p.longitude] as [number, number])}
        buses={last ? [{ id: trip.id, latitude: last.latitude, longitude: last.longitude, label: routeName }] : []}
      />
    </section>
  );
}

function TripForm({
  routes,
  drivers,
  monitors,
  vehicles,
  onCreated,
}: {
  routes: Route[];
  drivers: User[];
  monitors: User[];
  vehicles: Vehicle[];
  onCreated: () => void;
}) {
  const [routeId, setRouteId] = useState("");
  const [direction, setDirection] = useState<"outbound" | "return">("outbound");
  const [date, setDate] = useState(todayKey());
  const [driverId, setDriverId] = useState("");
  const [monitorId, setMonitorId] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const max = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!routeId || !driverId || !date) {
      setMessage({ ok: false, text: "Seleccione ruta, conductor y fecha." });
      return;
    }
    const route = routes.find((r) => r.id === Number(routeId));
    try {
      await api.createTrip({
        route_id: Number(routeId),
        driver_id: Number(driverId),
        monitor_id: monitorId ? Number(monitorId) : null,
        vehicle_id: route?.vehicle_id ?? null,
        direction,
        scheduled_date: date,
      });
      setMessage({ ok: true, text: "Recorrido programado. El conductor ya lo ve en su pantalla." });
      onCreated();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo programar." });
    }
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2>Programar recorrido</h2>
      <div className="form-grid">
        <SelectField label="Ruta" value={routeId} onChange={setRouteId} placeholder="Seleccione…" options={routes.map((r) => ({ value: r.id, label: r.name }))} />
        <SelectField
          label="Sentido"
          value={direction}
          onChange={(v) => setDirection(v as "outbound" | "return")}
          options={[
            { value: "outbound", label: DIRECTION_LABEL.outbound },
            { value: "return", label: DIRECTION_LABEL.return },
          ]}
        />
        <label className="field">
          <span className="field-label">Fecha</span>
          <input type="date" value={date} min={todayKey()} max={max} required onChange={(e) => setDate(e.target.value)} />
        </label>
        <SelectField
          label="Conductor"
          value={driverId}
          onChange={setDriverId}
          placeholder="Seleccione…"
          options={drivers.filter((d) => d.active).map((d) => ({ value: d.id, label: `${d.first_name} ${d.last_name}` }))}
        />
        <SelectField
          label="Monitor"
          required={false}
          value={monitorId}
          onChange={setMonitorId}
          placeholder="Sin monitor"
          options={monitors.filter((m) => m.active).map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))}
        />
      </div>
      {vehicles.length > 0 && routeId && (
        <small className="muted">
          Bus: {vehicles.find((v) => v.id === routes.find((r) => r.id === Number(routeId))?.vehicle_id)?.plate ?? "sin asignar"}
        </small>
      )}
      {message && <p className={message.ok ? "form-ok" : "form-error"}>{message.text}</p>}
      <div className="form-actions">
        <button type="submit" className="button button-primary">
          Programar
        </button>
      </div>
    </form>
  );
}
