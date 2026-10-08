// Coordinator overview: what is happening today and who was absent.

import { Link } from "react-router-dom";
import { api, loadAllStops, loadHistories } from "../../api";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { EVENT_LABEL, formatDateTime, formatTime, isToday, TRIP_STATUS_LABEL } from "../../format";
import { useLoad } from "../../useLoad";

export function Dashboard() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [trips, routes, students, users] = await Promise.all([api.trips(), api.routes(), api.students(), api.users()]);
    const [stopsByRoute, histories] = await Promise.all([
      loadAllStops(routes),
      loadHistories(students.map((s) => s.id)),
    ]);
    return { trips, routes, students, users, stopsByRoute, histories };
  }, []);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Error"} onRetry={reload} />;

  const { trips, routes, students, users, stopsByRoute, histories } = data;
  const routeName = (id: number) => routes.find((r) => r.id === id)?.name ?? `Ruta ${id}`;
  const userName = (id: number | null) => users.find((u) => u.id === id)?.name ?? "Sin conductor";
  const studentName = (id: number) => students.find((s) => s.id === id)?.full_name ?? `Estudiante ${id}`;
  const stopName = (id: number | null) =>
    Object.values(stopsByRoute).flat().find((stop) => stop.id === id)?.name ?? "—";

  const allEvents = Object.values(histories).flat();
  const todayEvents = allEvents.filter((e) => isToday(e.timestamp)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const activeTrips = trips.filter((t) => t.status !== "finished");
  const inProgress = trips.filter((t) => t.status === "in_progress").length;

  // For each route, the students who did not board on its last finished trip.
  const absences = routes
    .map((route) => {
      const lastFinished = trips
        .filter((t) => t.route_id === route.id && t.status === "finished")
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))[0];
      if (!lastFinished) return null;
      const boarded = new Set(
        allEvents.filter((e) => e.trip_id === lastFinished.id && e.event_type === "boarding").map((e) => e.student_id),
      );
      const absent = students.filter((s) => s.route_id === route.id && s.active && !boarded.has(s.id));
      return { route, trip: lastFinished, absent };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <PageHeader title="Resumen">
        <button type="button" className="button button-quiet" onClick={reload} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </PageHeader>

      <p className="summary-line">
        <span><strong>{students.length}</strong> estudiantes</span>
        <span><strong>{routes.length}</strong> rutas</span>
        <span><strong>{inProgress}</strong> {inProgress === 1 ? "recorrido en curso" : "recorridos en curso"}</span>
        <span><strong>{todayEvents.length}</strong> registros hoy</span>
      </p>

      <div className="columns">
        <section className="panel">
          <h2>Recorridos pendientes y en curso</h2>
          {activeTrips.length === 0 ? (
            <p className="muted">
              No hay recorridos programados. <Link to="/recorridos">Programar un recorrido</Link>
            </p>
          ) : (
            <ul className="plain-list">
              {activeTrips.map((trip) => (
                <li key={trip.id} className="list-row">
                  <span>
                    {routeName(trip.route_id)}
                    <small>{userName(trip.driver_id)}</small>
                  </span>
                  <span className={`status status-${trip.status}`}>{TRIP_STATUS_LABEL[trip.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>No subieron en el último recorrido</h2>
          {absences.length === 0 ? (
            <p className="muted">Todavía no hay recorridos finalizados.</p>
          ) : (
            absences.map(({ route, trip, absent }) => (
              <div key={route.id} className="absence">
                <p>
                  <strong>{route.name}</strong>{" "}
                  <small className="muted">{formatDateTime(trip.started_at)}</small>
                </p>
                {absent.length === 0 ? (
                  <p className="muted">Subieron todos los estudiantes.</p>
                ) : (
                  <ul className="tag-list">
                    {absent.map((s) => (
                      <li key={s.id} className="tag tag-alert">
                        {s.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Actividad de hoy</h2>
        {todayEvents.length === 0 ? (
          <p className="muted">Hoy todavía no hay registros de abordaje.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Estudiante</th>
                  <th>Evento</th>
                  <th>Parada</th>
                  <th>Método</th>
                </tr>
              </thead>
              <tbody>
                {todayEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatTime(event.timestamp)}</td>
                    <td>{studentName(event.student_id)}</td>
                    <td>{EVENT_LABEL[event.event_type]}</td>
                    <td>{stopName(event.stop_id)}</td>
                    <td>{event.method === "qr" ? "Código QR" : "Manual"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
