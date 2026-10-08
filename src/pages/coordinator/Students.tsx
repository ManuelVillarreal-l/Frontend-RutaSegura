// Coordinator: list, search and register students.

import { useState, type FormEvent } from "react";
import { api, loadAllStops } from "../../api";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { useLoad } from "../../useLoad";

export function Students() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [students, routes, users] = await Promise.all([api.students(), api.routes(), api.users()]);
    const stopsByRoute = await loadAllStops(routes);
    return { students, routes, users, stopsByRoute };
  }, []);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Error"} onRetry={reload} />;

  const { students, routes, users, stopsByRoute } = data;
  const guardians = users.filter((u) => u.role === "guardian");
  const routeName = (id: number | null) => routes.find((r) => r.id === id)?.name ?? "—";
  const stopName = (id: number | null) => Object.values(stopsByRoute).flat().find((s) => s.id === id)?.name ?? "—";
  const guardianName = (id: number | null) => users.find((u) => u.id === id)?.name ?? "—";

  const needle = query.trim().toLowerCase();
  const visible = students.filter(
    (s) => !needle || s.full_name.toLowerCase().includes(needle) || s.qr_code.toLowerCase().includes(needle),
  );

  return (
    <>
      <PageHeader title="Estudiantes">
        <button type="button" className="button button-primary" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
          {showForm ? "Cerrar formulario" : "Registrar estudiante"}
        </button>
      </PageHeader>

      {showForm && (
        <StudentForm
          routes={routes}
          stopsByRoute={stopsByRoute}
          guardians={guardians}
          onCreated={(name, qr) => {
            setCreated(`${name} quedó registrado con el código ${qr}.`);
            setShowForm(false);
            void reload();
          }}
        />
      )}
      {created && <Notice kind="success">{created}</Notice>}

      <label className="field search">
        <span>Buscar por nombre o código QR</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Grado</th>
              <th>Código QR</th>
              <th>Acudiente</th>
              <th>Ruta</th>
              <th>Parada</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => (
              <tr key={student.id}>
                <td>{student.full_name}</td>
                <td>{student.grade}</td>
                <td><code>{student.qr_code}</code></td>
                <td>{guardianName(student.guardian_id)}</td>
                <td>{routeName(student.route_id)}</td>
                <td>{stopName(student.stop_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="muted table-empty">Ningún estudiante coincide con “{query}”.</p>}
      </div>
    </>
  );
}

function StudentForm({
  routes,
  stopsByRoute,
  guardians,
  onCreated,
}: {
  routes: { id: number; name: string }[];
  stopsByRoute: Record<number, { id: number; name: string }[]>;
  guardians: { id: number; name: string }[];
  onCreated: (name: string, qr: string) => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    grade: "",
    school: "Institución Educativa Rural",
    guardian_id: guardians[0]?.id ?? 0,
    route_id: routes[0]?.id ?? 0,
    stop_id: 0,
    qr_code: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const stops = stopsByRoute[form.route_id] ?? [];
  const stopId = stops.some((s) => s.id === form.stop_id) ? form.stop_id : stops[0]?.id ?? 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const student = await api.createStudent({
        full_name: form.full_name.trim(),
        grade: form.grade.trim(),
        school: form.school.trim(),
        guardian_id: form.guardian_id || null,
        route_id: form.route_id || null,
        stop_id: stopId || null,
        qr_code: form.qr_code.trim() || null,
      });
      onCreated(student.full_name, student.qr_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar.");
    } finally {
      setSending(false);
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: ["guardian_id", "route_id", "stop_id"].includes(key) ? Number(e.target.value) : e.target.value });

  return (
    <form className="panel form form-grid" onSubmit={submit}>
      <label className="field">
        <span>Nombre completo</span>
        <input required value={form.full_name} onChange={set("full_name")} />
      </label>
      <label className="field">
        <span>Grado</span>
        <input required value={form.grade} onChange={set("grade")} placeholder="Ej.: 5°" />
      </label>
      <label className="field">
        <span>Institución</span>
        <input required value={form.school} onChange={set("school")} />
      </label>
      <label className="field">
        <span>Acudiente</span>
        <select value={form.guardian_id} onChange={set("guardian_id")}>
          {guardians.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Ruta</span>
        <select value={form.route_id} onChange={set("route_id")}>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Parada donde lo recogen</span>
        <select value={stopId} onChange={set("stop_id")}>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Código QR (opcional)</span>
        <input value={form.qr_code} onChange={set("qr_code")} placeholder="Se genera solo si lo deja vacío" />
      </label>
      <div className="form-actions">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={sending}>
          {sending ? "Guardando…" : "Guardar estudiante"}
        </button>
      </div>
    </form>
  );
}



