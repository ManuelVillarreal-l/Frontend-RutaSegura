// Coordinator overview: numbers of the day, buses on the map, attendance chart and alerts.

import { Link } from "react-router-dom";
import { api } from "../../api";
import { BarChart } from "../../components/Charts";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { MapView } from "../../components/MapView";
import { DIRECTION_LABEL, formatDateTime, formatPlainDate, minutesAgo, todayKey } from "../../format";
import { useInterval, useLoad } from "../../hooks";

export function Dashboard() {
  const data = useLoad(async () => {
    const [summary, trips, routes, incidents, rotation] = await Promise.all([
      api.summary(),
      api.trips(),
      api.routes(),
      api.incidents(true),
      api.monitorRotation(5),
    ]);
    return { summary, trips, routes, incidents, rotation };
  }, []);
  useInterval(() => void data.reload(true), 20_000);

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;

  const { summary, trips, routes, incidents, rotation } = data.data;
  const today = trips.filter((t) => t.scheduled_date === todayKey());
  const routeName = (id: number) => routes.find((r) => r.id === id)?.name ?? `Ruta ${id}`;
  const live = summary.trips_in_progress.filter((t) => t.latitude !== null && t.longitude !== null);
  const rates = summary.attendance_last_7_days.filter((d) => d.rate !== null).map((d) => d.rate as number);
  const average = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

  return (
    <>
      <PageHeader title="Resumen" />
      <p className="summary-line">
        <span>
          <strong>{summary.students}</strong> estudiantes
        </span>
        <span>
          <strong>{summary.routes}</strong> rutas
        </span>
        <span>
          <strong>{summary.trips_in_progress.length}</strong> buses en recorrido
        </span>
        <span>
          <strong>{summary.trips_scheduled}</strong> recorridos programados
        </span>
        <span>
          <strong className={summary.open_incidents ? "text-alert" : ""}>{summary.open_incidents}</strong> incidentes
          abiertos
        </span>
      </p>

      <div className="columns">
        <section className="panel">
          <h2>Buses en este momento</h2>
          {summary.trips_in_progress.length === 0 ? (
            <p className="muted">No hay buses en recorrido. Cuando un conductor inicie, aparecerá aquí en el mapa.</p>
          ) : (
            <ul className="plain-list">
              {summary.trips_in_progress.map((t) => (
                <li key={t.trip_id} className="list-row">
                  <span>
                    {t.route_name}
                    <small>{t.last_seen ? `Visto ${minutesAgo(t.last_seen)}` : "Sin GPS todavía"}</small>
                  </span>
                  <Link to={`/recorridos?ver=${t.trip_id}`}>Seguir</Link>
                </li>
              ))}
            </ul>
          )}
          <MapView
            height={260}
            buses={live.map((t) => ({ id: t.trip_id, latitude: t.latitude!, longitude: t.longitude!, label: t.route_name }))}
            label="Mapa con los buses en recorrido"
          />
        </section>

        <section className="panel">
          <h2>Asistencia de los últimos 7 días</h2>
          <p className="muted">
            Estudiantes que subieron al bus en los recorridos de ida
            {average !== null ? ` · promedio ${average}%` : ""}.
          </p>
          <BarChart
            title="Porcentaje de asistencia por día"
            bars={summary.attendance_last_7_days.map((d) => ({
              label: shortDay(d.date),
              value: d.rate,
              detail: `${d.boarded} de ${d.assigned} estudiantes`,
            }))}
          />
        </section>
      </div>

      <div className="columns">
        <section className="panel">
          <h2>Recorridos de hoy</h2>
          {today.length === 0 ? (
            <p className="muted">No hay recorridos para hoy.</p>
          ) : (
            <ul className="plain-list">
              {today.map((t) => (
                <li key={t.id} className="list-row">
                  <span>
                    {routeName(t.route_id)}
                    <small>
                      {DIRECTION_LABEL[t.direction]}
                      {t.weather ? ` · ${t.weather.name} · vía ${t.road_condition?.name.toLowerCase()}` : ""}
                    </small>
                  </span>
                  <span className={`status status-${t.status.code}`}>{t.status.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Incidentes abiertos</h2>
          {incidents.length === 0 ? (
            <p className="muted">Sin incidentes abiertos.</p>
          ) : (
            <ul className="plain-list">
              {incidents.slice(0, 5).map((i) => (
                <li key={i.id} className="list-row">
                  <span>
                    {i.incident_type.name}
                    <small>
                      {i.description} · {formatDateTime(i.created_at)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/incidentes">Ver todos</Link>
        </section>

        <section className="panel">
          <h2>Monitores de turno</h2>
          <p className="muted">Rotación automática en días hábiles (lista circular).</p>
          <ul className="plain-list">
            {rotation.map((r) => (
              <li key={r.date} className="list-row">
                <span>{formatPlainDate(r.date)}</span>
                <strong>{r.monitor.full_name}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

// "sáb 3" style label for the chart axis.
function shortDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (date === todayKey()) return "Hoy";
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "short" });
  return `${weekday.replace(".", "")} ${d}`;
}
