// Daily attendance matrix (student × school day). The API builds it with the
// AttendanceMatrix structure (a two-dimensional array).

import { useState } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { SelectField } from "../../components/Fields";
import { useLoad } from "../../hooks";

const DAY_OPTIONS = [
  { value: 5, label: "Última semana (5 días hábiles)" },
  { value: 10, label: "Últimas 2 semanas (10 días hábiles)" },
  { value: 20, label: "Último mes (20 días hábiles)" },
];

const CELL_CLASS: Record<string, string> = { P: "cell-present", A: "cell-absent", "-": "cell-none" };

function shortDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function Attendance() {
  const routes = useLoad(() => api.routes(), []);
  const [routeId, setRouteId] = useState("");
  const [days, setDays] = useState("10");

  const selectedRoute = routeId || (routes.data && routes.data[0] ? String(routes.data[0].id) : "");
  const matrix = useLoad(
    async () => (selectedRoute ? api.attendanceMatrix(Number(selectedRoute), Number(days)) : null),
    [selectedRoute, days],
  );

  if (routes.loading && !routes.data) return <Loading />;
  if (routes.error || !routes.data) return <ErrorBox message={routes.error ?? "Error"} onRetry={routes.reload} />;

  return (
    <>
      <PageHeader title="Asistencia diaria" />
      <p className="muted">
        Matriz de asistencia: cada fila es un estudiante y cada columna un día hábil. <b>P</b> = subió al bus,{" "}
        <b>A</b> = hubo recorrido pero no subió, <b>-</b> = no hubo recorrido ese día.
      </p>

      <div className="form-grid">
        <SelectField
          label="Ruta"
          value={selectedRoute}
          onChange={setRouteId}
          options={routes.data.map((r) => ({ value: r.id, label: r.name }))}
        />
        <SelectField label="Periodo" value={days} onChange={setDays} options={DAY_OPTIONS} />
      </div>

      {matrix.loading && !matrix.data && <Loading text="Armando la matriz…" />}
      {matrix.error && <ErrorBox message={matrix.error} onRetry={matrix.reload} />}
      {matrix.data && (
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Estudiante</th>
                {matrix.data.days.map((d) => (
                  <th key={d} className="matrix-day">
                    {shortDay(d)}
                  </th>
                ))}
                <th>Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {matrix.data.students.map((s, i) => (
                <tr key={s.student_id}>
                  <td>{s.full_name}</td>
                  {matrix.data!.cells[i].map((cell, j) => (
                    <td
                      key={matrix.data!.days[j]}
                      className={`matrix-cell ${CELL_CLASS[cell] ?? ""}`}
                      title={matrix.data!.legend[cell] ?? cell}
                    >
                      {cell}
                    </td>
                  ))}
                  <td>{s.attendance_rate === null ? "—" : `${Math.round(s.attendance_rate * 100)} %`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Presentes por día</th>
                {matrix.data.present_per_day.map((count, j) => (
                  <th key={matrix.data!.days[j]} className="matrix-cell">
                    {count}
                  </th>
                ))}
                <th />
              </tr>
            </tfoot>
          </table>
          {matrix.data.students.length === 0 && <p className="table-empty muted">Esta ruta no tiene estudiantes activos.</p>}
        </div>
      )}
    </>
  );
}
