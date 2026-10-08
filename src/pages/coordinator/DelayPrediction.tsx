// Delay prediction form (rule-based heuristic in the API).

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { PageHeader } from "../../components/Feedback";
import type { DelayPrediction as Prediction } from "../../types";

const WEATHER = [
  { value: "normal", label: "Despejado" },
  { value: "cloudy", label: "Nublado" },
  { value: "rain", label: "Lluvia" },
  { value: "storm", label: "Tormenta" },
];

const ROAD = [
  { value: "good", label: "Buena" },
  { value: "fair", label: "Regular" },
  { value: "bad", label: "Mala" },
  { value: "closed", label: "Cerrada" },
];

const RISK_LABEL = { low: "Bajo", medium: "Medio", high: "Alto" } as const;

export function DelayPrediction() {
  const [form, setForm] = useState({ weather: "normal", road_condition: "good", historical: "0", stops: "3" });
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setResult(
        await api.predictDelay({
          weather: form.weather,
          road_condition: form.road_condition,
          historical_delay_minutes: Number(form.historical) || 0,
          stops_remaining: Number(form.stops) || 0,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular.");
    }
  }

  return (
    <>
      <PageHeader title="Predicción de retrasos" />
      <p className="lead">Estime cuánto puede retrasarse un recorrido según el clima, el estado de la vía y las paradas que faltan.</p>

      <div className="columns">
        <form className="panel form" onSubmit={submit}>
          <label className="field">
            <span>Clima</span>
            <select value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })}>
              {WEATHER.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Estado de la vía</span>
            <select value={form.road_condition} onChange={(e) => setForm({ ...form, road_condition: e.target.value })}>
              {ROAD.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Retraso habitual de la ruta (minutos)</span>
            <input type="number" min={0} value={form.historical} onChange={(e) => setForm({ ...form, historical: e.target.value })} />
          </label>
          <label className="field">
            <span>Paradas que faltan</span>
            <input type="number" min={0} value={form.stops} onChange={(e) => setForm({ ...form, stops: e.target.value })} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="button button-primary">Calcular retraso</button>
        </form>

        <section className={`panel prediction ${result ? `risk-${result.risk}` : ""}`} aria-live="polite">
          {result ? (
            <>
              <p className="prediction-value">
                {result.estimated_delay_minutes} <span>minutos de retraso estimado</span>
              </p>
              <p>Riesgo <strong>{RISK_LABEL[result.risk].toLowerCase()}</strong></p>
              <ul>
                {result.factors.map((factor) => <li key={factor}>{factor[0].toUpperCase() + factor.slice(1)}</li>)}
              </ul>
            </>
          ) : (
            <p className="muted">El resultado aparecerá aquí.</p>
          )}
        </section>
      </div>
    </>
  );
}
