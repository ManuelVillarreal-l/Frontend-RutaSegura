// Guardian screen: where each child is today and their boarding history.

import { api, loadAllStops, loadHistories } from "../../api";
import { useCurrentUser } from "../../auth";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { RouteLine } from "../../components/RouteLine";
import { EVENT_LABEL, formatDay, formatTime, isToday } from "../../format";
import type { AttendanceEvent, Route, Stop, Student } from "../../types";
import { useLoad } from "../../useLoad";

export function GuardianHome() {
  const user = useCurrentUser();

  const { data, error, loading, reload } = useLoad(async () => {
    const [students, routes] = await Promise.all([api.students(), api.routes()]);
    const children = students.filter((student) => student.guardian_id === user.id);
    const [stopsByRoute, histories] = await Promise.all([
      loadAllStops(routes.filter((route) => children.some((child) => child.route_id === route.id))),
      loadHistories(children.map((child) => child.id)),
    ]);
    return { children, routes, stopsByRoute, histories };
  }, [user.id]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Error"} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Mis hijos">
        <button type="button" className="button button-quiet" onClick={reload} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </PageHeader>

      {data.children.length === 0 && (
        <Notice>No hay estudiantes asociados a su cuenta. Comuníquese con el coordinador de transporte.</Notice>
      )}

      <div className="children">
        {data.children.map((child) => (
          <ChildCard
            key={child.id}
            child={child}
            route={data.routes.find((route) => route.id === child.route_id) ?? null}
            stops={child.route_id ? data.stopsByRoute[child.route_id] ?? [] : []}
            events={data.histories[child.id] ?? []}
          />
        ))}
      </div>
    </>
  );
}

function ChildCard({
  child,
  route,
  stops,
  events,
}: {
  child: Student;
  route: Route | null;
  stops: Stop[];
  events: AttendanceEvent[];
}) {
  const stopName = (id: number | null) => stops.find((stop) => stop.id === id)?.name ?? "parada sin registrar";
  const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const lastToday = sorted.find((event) => isToday(event.timestamp)) ?? null;

  let status: { tone: string; text: string };
  if (!lastToday) {
    status = { tone: "idle", text: "Hoy todavía no ha subido al bus." };
  } else if (lastToday.event_type === "boarding") {
    status = {
      tone: "moving",
      text: `Va en el bus. Subió a las ${formatTime(lastToday.timestamp)} en ${stopName(lastToday.stop_id)}.`,
    };
  } else {
    status = {
      tone: "arrived",
      text: `Bajó del bus a las ${formatTime(lastToday.timestamp)} en ${stopName(lastToday.stop_id)}.`,
    };
  }

  // Group history by day (most recent first).
  const days = new Map<string, AttendanceEvent[]>();
  for (const event of sorted) {
    const day = formatDay(event.timestamp);
    days.set(day, [...(days.get(day) ?? []), event]);
  }

  return (
    <article className="child">
      <header className="child-head">
        <h2>{child.full_name}</h2>
        <p className="muted">
          Grado {child.grade}, {route?.name ?? "sin ruta asignada"}
        </p>
      </header>

      <p className={`child-status tone-${status.tone}`}>{status.text}</p>

      <div className="child-body">
        <section>
          <h3>Ruta</h3>
          <RouteLine
            stops={stops}
            highlightStopId={child.stop_id}
            busStopId={lastToday?.event_type === "drop_off" ? lastToday.stop_id : null}
            renderStop={(stop) =>
              stop.id === child.stop_id ? <small className="muted">Parada de {child.full_name.split(" ")[0]}</small> : null
            }
          />
        </section>

        <section>
          <h3>Historial</h3>
          {sorted.length === 0 ? (
            <p className="muted">Todavía no hay registros.</p>
          ) : (
            [...days.entries()].slice(0, 7).map(([day, dayEvents]) => (
              <div key={day} className="history-day">
                <h4>{day}</h4>
                <ul className="history">
                  {[...dayEvents].reverse().map((event) => (
                    <li key={event.id} className={`history-item is-${event.event_type}`}>
                      <time>{formatTime(event.timestamp)}</time>
                      <span>
                        {EVENT_LABEL[event.event_type]} en {stopName(event.stop_id)}
                        <small>{event.method === "qr" ? "con código QR" : "registro manual"}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </article>
  );
}
