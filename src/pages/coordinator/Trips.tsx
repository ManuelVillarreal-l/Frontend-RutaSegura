// Coordinator: all trips, schedule a new one, start or finish them.

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { formatDateTime, TRIP_STATUS_LABEL } from "../../format";
import { useLoad } from "../../useLoad";

export function Trips() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [trips, routes, users] = await Promise.all([api.trips(), api.routes(), api.users()]);
    return { trips, routes, users };
  }, []);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [routeId, setRouteId] = useState(0);
  const [driverId, setDriverId] = useState(0);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Error"} onRetry={reload} />;

  const { trips, routes, users } = data;
  const drivers = users.filter((u) => u.role === "driver");
  const routeName = (id: number) => routes.find((r) => r.id === id)?.name ?? `Ruta ${id}`;
  const userName = (id: number | null) => users.find((u) => u.id === id)?.name ?? "Sin conductor";
  const selectedRoute = routeId || routes[0]?.id || 0;
  const selectedDriver = driverId || drivers[0]?.id || 0;

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "success", text: success });
      await reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "No se pudo completar la acción." });
    }
  }

  function schedule(event: FormEvent) {
    event.preventDefault();
    void run(
      () => api.createTrip({ route_id: selectedRoute, driver_id: selectedDriver || null }),
      `Recorrido programado para ${routeName(selectedRoute)}.`,
    );
  }

  return (
    <>
      <PageHeader title="Recorridos" />

      <form className="panel form form-inline" onSubmit={schedule}>
        <label className="field">
          <span>Ruta</span>
          <select value={selectedRoute} onChange={(e) => setRouteId(Number(e.target.value))}>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Conductor</span>
          <select value={selectedDriver} onChange={(e) => setDriverId(Number(e.target.value))}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="button button-primary">Programar recorrido</button>
      </form>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ruta</th>
              <th>Conductor</th>
              <th>Estado</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id}>
                <td>{trip.id}</td>
                <td>{routeName(trip.route_id)}</td>
                <td>{userName(trip.driver_id)}</td>
                <td><span className={`status status-${trip.status}`}>{TRIP_STATUS_LABEL[trip.status]}</span></td>
                <td>{formatDateTime(trip.started_at)}</td>
                <td>{formatDateTime(trip.finished_at)}</td>
                <td className="cell-actions">
                  {trip.status === "scheduled" && (
                    <button type="button" className="button button-quiet" onClick={() => run(() => api.startTrip(trip.id), `Recorrido #${trip.id} iniciado.`)}>
                      Iniciar
                    </button>
                  )}
                  {trip.status === "in_progress" && (
                    <button type="button" className="button button-quiet" onClick={() => run(() => api.finishTrip(trip.id), `Recorrido #${trip.id} finalizado.`)}>
                      Finalizar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}



