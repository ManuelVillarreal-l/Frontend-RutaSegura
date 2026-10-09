// Routes: stops on the map (click to place a new stop), road segments (graph),
// shortest path (Dijkstra), outbound/return itinerary and AI route optimization.

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { isValidNumber, NumberField, SelectField, TextField } from "../../components/Fields";
import { MapView } from "../../components/MapView";
import { useLoad } from "../../hooks";
import type { Route, RouteOptimization, ShortestPath } from "../../types";
import { check, RULES } from "../../validation";

export function RoutesPage() {
  const base = useLoad(async () => {
    const [routes, schools, vehicles] = await Promise.all([api.routes(), api.schools(), api.vehicles()]);
    return { routes, schools, vehicles };
  }, []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  if (base.loading && !base.data) return <Loading />;
  if (base.error || !base.data) return <ErrorBox message={base.error ?? "Error"} onRetry={base.reload} />;
  const { routes, schools, vehicles } = base.data;
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0] ?? null;

  return (
    <>
      <PageHeader title="Rutas">
        <button type="button" className="button button-primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cerrar formulario" : "Crear ruta"}
        </button>
      </PageHeader>

      {creating && (
        <RouteForm
          campuses={schools.flatMap((s) => s.campuses)}
          vehicles={vehicles}
          onCreated={async (route) => {
            setCreating(false);
            await base.reload(true);
            setSelectedId(route.id);
          }}
        />
      )}

      <div className="segmented" role="tablist" aria-label="Rutas">
        {routes.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === selected?.id}
            className="segmented-item"
            onClick={() => setSelectedId(r.id)}
          >
            {r.name}
            <small>{vehicles.find((v) => v.id === r.vehicle_id)?.plate ?? "Sin bus"}</small>
          </button>
        ))}
      </div>

      {selected && <RouteDetail key={selected.id} route={selected} />}
    </>
  );
}

function RouteDetail({ route }: { route: Route }) {
  const data = useLoad(async () => {
    const [stops, segments] = await Promise.all([api.stops(route.id), api.segments(route.id)]);
    return { stops, segments };
  }, [route.id]);
  const [point, setPoint] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [direction, setDirection] = useState<"outbound" | "return">("outbound");
  const itinerary = useLoad(() => api.itinerary(route.id, direction), [route.id, direction]);
  const [optimization, setOptimization] = useState<RouteOptimization | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;
  const { stops, segments } = data.data;
  const name = (id: number) => stops.find((s) => s.id === id)?.name ?? `#${id}`;
  const preview =
    isValidNumber(point.lat, -90, 90) && isValidNumber(point.lng, -180, 180)
      ? [{ id: -1, name: "Nueva parada", latitude: Number(point.lat), longitude: Number(point.lng), highlight: true }]
      : [];

  async function optimize() {
    setOptimizing(true);
    try {
      setOptimization(await api.optimizeRoute(route.id));
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <>
      {route.description && <p className="lead">{route.description}</p>}
      <div className="columns">
        <section className="panel">
          <h2>Mapa de paradas</h2>
          <p className="muted">Haga clic en el mapa para ubicar una parada nueva.</p>
          <MapView
            height={360}
            stops={[...stops.map((s, i) => ({ ...s, isSchool: i === stops.length - 1 })), ...preview]}
            onMapClick={(lat, lng) => setPoint({ lat: lat.toFixed(6), lng: lng.toFixed(6) })}
          />
          <StopForm routeId={route.id} point={point} setPoint={setPoint} onCreated={() => data.reload(true)} />
        </section>

        <section className="panel">
          <h2>Itinerario</h2>
          <div className="segmented">
            {(["outbound", "return"] as const).map((d) => (
              <button key={d} type="button" className="segmented-item" aria-selected={direction === d} onClick={() => setDirection(d)}>
                {d === "outbound" ? "Ida al colegio" : "Regreso a casa"}
              </button>
            ))}
          </div>
          <ol className="itinerary">
            {(itinerary.data?.stops ?? []).map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ol>
          <small className="muted">Lista doblemente enlazada: el regreso recorre la misma lista hacia atrás.</small>

          <h2 className="spaced">Optimización con IA</h2>
          <p className="muted">Vecino más cercano + mejora 2-opt sobre las distancias GPS reales.</p>
          <button type="button" className="button button-primary" disabled={optimizing || stops.length < 3} onClick={() => void optimize()}>
            {optimizing ? "Calculando…" : "Sugerir mejor orden de paradas"}
          </button>
          {optimization && (
            <div className="optimization">
              <p>
                <strong>
                  {optimization.saving_percent > 0
                    ? `Ahorro de ${optimization.saving_percent}%: ${optimization.original_km} km → ${optimization.suggested_km} km`
                    : `El orden actual ya es el mejor (${optimization.original_km} km).`}
                </strong>
              </p>
              <div className="compare">
                <div>
                  <h4>Orden actual</h4>
                  <ol>
                    {optimization.original_order.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4>Orden sugerido</h4>
                  <ol>
                    {optimization.suggested_order.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="columns">
        <section className="panel">
          <h2>Tramos de vía (grafo)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Km</th>
                  <th>Minutos</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.id}>
                    <td>{name(s.from_stop_id)}</td>
                    <td>{name(s.to_stop_id)}</td>
                    <td>{s.distance_km}</td>
                    <td>{s.travel_minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {segments.length === 0 && <p className="table-empty muted">Sin tramos registrados.</p>}
          </div>
          {stops.length >= 2 && <SegmentForm routeId={route.id} stops={stops} onCreated={() => data.reload(true)} />}
        </section>

        <section className="panel">
          <h2>Camino más corto</h2>
          <p className="muted">Algoritmo de Dijkstra sobre los tramos de vía (útil si hay un derrumbe).</p>
          {stops.length >= 2 ? <ShortestPathTool routeId={route.id} stops={stops} /> : <p className="muted">Agregue paradas primero.</p>}
        </section>
      </div>
    </>
  );
}

function RouteForm({
  campuses,
  vehicles,
  onCreated,
}: {
  campuses: { id: number; name: string }[];
  vehicles: { id: number; plate: string }[];
  onCreated: (r: Route) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campusId, setCampusId] = useState(String(campuses[0]?.id ?? ""));
  const [vehicleId, setVehicleId] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (check(RULES.label, name) || check(RULES.label, description, false)) return;
    try {
      onCreated(
        await api.createRoute({
          name: name.trim(),
          description: description.trim() || null,
          campus_id: Number(campusId),
          vehicle_id: vehicleId ? Number(vehicleId) : null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la ruta.");
    }
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2>Nueva ruta</h2>
      <div className="form-grid">
        <TextField label="Nombre" rule={RULES.label} value={name} onChange={setName} placeholder="Ruta Rural 04" showErrors={tried} />
        <TextField label="Descripción" rule={RULES.label} required={false} value={description} onChange={setDescription} showErrors={tried} />
        <SelectField label="Sede" value={campusId} onChange={setCampusId} options={campuses.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField
          label="Bus"
          required={false}
          value={vehicleId}
          onChange={setVehicleId}
          placeholder="Sin asignar"
          options={vehicles.map((v) => ({ value: v.id, label: v.plate }))}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="button button-primary">
          Crear ruta
        </button>
      </div>
    </form>
  );
}

function StopForm({
  routeId,
  point,
  setPoint,
  onCreated,
}: {
  routeId: number;
  point: { lat: string; lng: string };
  setPoint: (p: { lat: string; lng: string }) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (check(RULES.label, name) || !isValidNumber(point.lat, -90, 90) || !isValidNumber(point.lng, -180, 180)) return;
    setError(null);
    try {
      await api.createStop({ route_id: routeId, name: name.trim(), latitude: Number(point.lat), longitude: Number(point.lng) });
      setName("");
      setPoint({ lat: "", lng: "" });
      setTried(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la parada.");
    }
  }

  return (
    <form className="form subform" onSubmit={submit} noValidate>
      <h3>Agregar parada al final de la ruta</h3>
      <div className="form-grid">
        <TextField label="Nombre" rule={RULES.label} value={name} onChange={setName} placeholder="Vereda El Carrizo" showErrors={tried} />
        <NumberField label="Latitud" value={point.lat} onChange={(v) => setPoint({ ...point, lat: v })} min={-90} max={90} step={0.000001} />
        <NumberField label="Longitud" value={point.lng} onChange={(v) => setPoint({ ...point, lng: v })} min={-180} max={180} step={0.000001} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary">
        Agregar parada
      </button>
    </form>
  );
}

function SegmentForm({ routeId, stops, onCreated }: { routeId: number; stops: { id: number; name: string }[]; onCreated: () => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [km, setKm] = useState("");
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!from || !to || from === to) {
      setError("Seleccione dos paradas diferentes.");
      return;
    }
    if (!isValidNumber(km, 0.1, 200) || !isValidNumber(minutes, 1, 300)) {
      setError("Revise la distancia (0,1 a 200 km) y los minutos (1 a 300).");
      return;
    }
    setError(null);
    try {
      await api.createSegment(routeId, {
        from_stop_id: Number(from),
        to_stop_id: Number(to),
        distance_km: Number(km),
        travel_minutes: Math.round(Number(minutes)),
      });
      setKm("");
      setMinutes("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el tramo.");
    }
  }

  const options = stops.map((s) => ({ value: s.id, label: s.name }));
  return (
    <form className="form subform" onSubmit={submit} noValidate>
      <h3>Agregar tramo</h3>
      <div className="form-grid">
        <SelectField label="Desde" value={from} onChange={setFrom} placeholder="Seleccione…" options={options} />
        <SelectField label="Hasta" value={to} onChange={setTo} placeholder="Seleccione…" options={options} />
        <NumberField label="Distancia (km)" value={km} onChange={setKm} min={0.1} max={200} step={0.1} />
        <NumberField label="Minutos" value={minutes} onChange={setMinutes} min={1} max={300} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary">
        Guardar tramo
      </button>
    </form>
  );
}

function ShortestPathTool({ routeId, stops }: { routeId: number; stops: { id: number; name: string }[] }) {
  const [from, setFrom] = useState(String(stops[0].id));
  const [to, setTo] = useState(String(stops[stops.length - 1].id));
  const [result, setResult] = useState<ShortestPath | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setResult(await api.shortestPath(routeId, Number(from), Number(to)));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "No hay camino.");
    }
  }

  const options = stops.map((s) => ({ value: s.id, label: s.name }));
  return (
    <form className="form" onSubmit={run}>
      <div className="form-grid">
        <SelectField label="Desde" value={from} onChange={setFrom} options={options} />
        <SelectField label="Hasta" value={to} onChange={setTo} options={options} />
      </div>
      <button type="submit" className="button button-primary">
        Calcular
      </button>
      {error && <Notice kind="error">{error}</Notice>}
      {result && (
        <div>
          <p>
            <strong>
              {result.distance_km} km · {result.travel_minutes} min
            </strong>
          </p>
          <ol className="itinerary">
            {result.path.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ol>
        </div>
      )}
    </form>
  );
}
