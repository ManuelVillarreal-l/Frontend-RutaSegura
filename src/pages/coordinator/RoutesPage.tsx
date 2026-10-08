// Coordinator: routes with their stops drawn as a road, plus forms to add routes and stops.

import { useState, type FormEvent } from "react";
import { api, loadAllStops } from "../../api";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { RouteLine } from "../../components/RouteLine";
import type { Route, Stop } from "../../types";
import { useLoad } from "../../useLoad";

export function RoutesPage() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [routes, students] = await Promise.all([api.routes(), api.students()]);
    const stopsByRoute = await loadAllStops(routes);
    return { routes, students, stopsByRoute };
  }, []);
  const [form, setForm] = useState<"route" | "stop" | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Error"} onRetry={reload} />;

  const { routes, students, stopsByRoute } = data;

  return (
    <>
      <PageHeader title="Rutas y paradas">
        <button type="button" className="button button-quiet" onClick={() => setForm(form === "stop" ? null : "stop")}>
          Agregar parada
        </button>
        <button type="button" className="button button-primary" onClick={() => setForm(form === "route" ? null : "route")}>
          Nueva ruta
        </button>
      </PageHeader>

      {form === "route" && <RouteForm onDone={() => { setForm(null); void reload(); }} />}
      {form === "stop" && (
        <StopForm routes={routes} stopsByRoute={stopsByRoute} onDone={() => { setForm(null); void reload(); }} />
      )}

      <div className="route-grid">
        {routes.map((route) => {
          const stops = stopsByRoute[route.id] ?? [];
          const count = students.filter((s) => s.route_id === route.id).length;
          return (
            <section key={route.id} className="panel">
              <h2>{route.name}</h2>
              <p className="muted">
                {route.description || "Sin descripción"}. {stops.length} paradas, {count} estudiantes.
              </p>
              <RouteLine
                stops={stops}
                renderStop={(stop) => {
                  const here = students.filter((s) => s.stop_id === stop.id).length;
                  return here > 0 ? <small className="muted">{here} {here === 1 ? "estudiante" : "estudiantes"}</small> : null;
                }}
              />
            </section>
          );
        })}
      </div>
    </>
  );
}

function RouteForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createRoute({ name: name.trim(), description: description.trim() || null });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la ruta.");
    }
  }

  return (
    <form className="panel form form-grid" onSubmit={submit}>
      <label className="field">
        <span>Nombre de la ruta</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Ruta Rural 03" />
      </label>
      <label className="field">
        <span>Descripción</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-actions">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary">Crear ruta</button>
      </div>
    </form>
  );
}

function StopForm({
  routes,
  stopsByRoute,
  onDone,
}: {
  routes: Route[];
  stopsByRoute: Record<number, Stop[]>;
  onDone: () => void;
}) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nextOrder = (stopsByRoute[routeId]?.length ?? 0) + 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createStop({
        route_id: routeId,
        name: name.trim(),
        order: nextOrder,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la parada.");
    }
  }

  return (
    <form className="panel form form-grid" onSubmit={submit}>
      <label className="field">
        <span>Ruta</span>
        <select value={routeId} onChange={(e) => setRouteId(Number(e.target.value))}>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Nombre de la parada</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Vereda Santa Lucía" />
      </label>
      <label className="field">
        <span>Latitud (opcional)</span>
        <input inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="1.2136" />
      </label>
      <label className="field">
        <span>Longitud (opcional)</span>
        <input inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-77.2811" />
      </label>
      <div className="form-actions">
        <p className="muted">Se agregará como parada número {nextOrder} de la ruta.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary">Agregar parada</button>
      </div>
    </form>
  );
}



