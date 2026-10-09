// Artificial intelligence: delay prediction (multiple linear regression trained with
// real trips), current weather from Open-Meteo and absence risk per student.

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import { useCatalog, useCurrentUser } from "../../auth";
import { RiskPill } from "../../components/Charts";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { isValidNumber, NumberField, SelectField } from "../../components/Fields";
import { localHour, RISK_LABEL } from "../../format";
import { getPositionOnce, useLoad } from "../../hooks";
import type { AbsenceRisk, CurrentWeather, DelayPrediction, Student } from "../../types";

export function Intelligence() {
  const user = useCurrentUser();
  return (
    <>
      <PageHeader title={user.role.code === "coordinator" ? "Inteligencia artificial" : "Predicción de retrasos"} />
      <div className="columns">
        <DelayPanel />
        <WeatherPanel />
      </div>
      {user.role.code === "coordinator" && <AbsencePanel />}
    </>
  );
}

function DelayPanel() {
  const weathers = useCatalog("weather_conditions");
  const roads = useCatalog("road_conditions");
  const routes = useLoad(() => api.routes(), []);
  const [routeId, setRouteId] = useState("");
  const [weather, setWeather] = useState("rain");
  const [road, setRoad] = useState("fair");
  const [stops, setStops] = useState("4");
  const [hour, setHour] = useState(String(localHour()));
  const [result, setResult] = useState<DelayPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidNumber(stops, 0, 50) || !isValidNumber(hour, 0, 23)) {
      setError("Revise el número de paradas (0 a 50) y la hora (0 a 23).");
      return;
    }
    setError(null);
    try {
      setResult(
        await api.predictDelay({
          route_id: routeId ? Number(routeId) : null,
          weather_code: weather,
          road_condition_code: road,
          stops_remaining: Number(stops),
          hour: Number(hour),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular.");
    }
  }

  return (
    <section className="panel">
      <h2>¿Cuánto se retrasará el bus?</h2>
      <p className="muted">
        Modelo de regresión lineal múltiple entrenado con los recorridos reales del historial (clima, vía, paradas y hora de
        salida).
      </p>
      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <SelectField
            label="Ruta"
            required={false}
            value={routeId}
            onChange={setRouteId}
            placeholder="Cualquiera"
            options={(routes.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
          />
          <SelectField label="Clima" value={weather} onChange={setWeather} options={weathers.map((w) => ({ value: w.code, label: w.name }))} />
          <SelectField label="Vía" value={road} onChange={setRoad} options={roads.map((r) => ({ value: r.code, label: r.name }))} />
          <NumberField label="Paradas por recorrer" value={stops} onChange={setStops} min={0} max={50} />
          <NumberField label="Hora de salida (0-23)" value={hour} onChange={setHour} min={0} max={23} />
        </div>
        <button type="submit" className="button button-primary">
          Predecir
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
      {result && (
        <div className={`prediction risk-${result.risk}`}>
          <p className="prediction-value">
            {result.estimated_delay_minutes} min
            <span>
              de retraso estimado · <RiskPill risk={result.risk} label={`Riesgo ${RISK_LABEL[result.risk].toLowerCase()}`} />
            </span>
          </p>
          <ul>
            {result.factors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {result.model === "regression" && result.r_squared !== null && (
            <p className="muted">
              El modelo explica el {Math.round(result.r_squared * 100)}% de la variación real de los retrasos (R²).
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function WeatherPanel() {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function detect() {
    setLoading(true);
    setError(null);
    try {
      // El Encano, Nariño, if the browser does not share the location.
      const where = await getPositionOnce().catch(() => ({ latitude: 1.1617, longitude: -77.1598 }));
      setWeather(await api.currentWeather(where.latitude, where.longitude));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el clima.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Clima actual</h2>
      <p className="muted">
        Se consulta el servicio meteorológico Open-Meteo con la ubicación GPS y se traduce al catálogo de climas de la base
        de datos.
      </p>
      <button type="button" className="button button-primary" disabled={loading} onClick={() => void detect()}>
        {loading ? "Consultando…" : "Consultar clima"}
      </button>
      {error && <p className="form-error">{error}</p>}
      {weather && (
        <dl className="facts">
          <div>
            <dt>Condición</dt>
            <dd>{weather.condition?.name ?? `Código ${weather.weather_code} (sin equivalencia)`}</dd>
          </div>
          <div>
            <dt>Temperatura</dt>
            <dd>{weather.temperature_c ?? "—"} °C</dd>
          </div>
          <div>
            <dt>Lluvia</dt>
            <dd>{weather.precipitation_mm ?? 0} mm</dd>
          </div>
          <div>
            <dt>Viento</dt>
            <dd>{weather.wind_kmh ?? "—"} km/h</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function AbsencePanel() {
  const students = useLoad(() => api.students(), []);
  const [risks, setRisks] = useState<Record<number, AbsenceRisk>>({});

  useEffect(() => {
    if (!students.data) return;
    Promise.all(students.data.map((s) => api.absenceRisk(s.id).catch(() => null))).then((list) =>
      setRisks(Object.fromEntries(list.filter(Boolean).map((r) => [r!.student_id, r!]))),
    );
  }, [students.data]);

  if (students.loading && !students.data) return <Loading />;
  if (students.error) return <ErrorBox message={students.error} onRetry={students.reload} />;

  const sorted = [...(students.data ?? [])].sort(
    (a: Student, b: Student) => (risks[b.id]?.absence_rate ?? 0) - (risks[a.id]?.absence_rate ?? 0),
  );

  return (
    <section className="panel">
      <h2>Riesgo de inasistencia</h2>
      <p className="muted">
        Tasa histórica de faltas de cada estudiante y su comportamiento los días de lluvia, para actuar antes de la deserción.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Faltas</th>
              <th>Con lluvia</th>
              <th>Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const r = risks[s.id];
              return (
                <tr key={s.id}>
                  <td>
                    {s.full_name}
                    {r && (
                      <>
                        <br />
                        <small className="muted">{r.explanation}</small>
                      </>
                    )}
                  </td>
                  <td>{r ? `${Math.round(r.absence_rate * 100)}%` : "…"}</td>
                  <td>{r?.rainy_absence_rate !== null && r ? `${Math.round(r.rainy_absence_rate! * 100)}%` : "—"}</td>
                  <td>{r && <RiskPill risk={r.risk} label={RISK_LABEL[r.risk]} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
