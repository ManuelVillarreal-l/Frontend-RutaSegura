// Students: fast search (AVL tree on the server), registration with guardians and
// printable ID card with QR code.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type NewStudent } from "../../api";
import { useCatalog } from "../../auth";
import { RiskPill } from "../../components/Charts";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { SelectField, TextField } from "../../components/Fields";
import { QrCard } from "../../components/QrCard";
import { age, formatDateTime, RISK_LABEL } from "../../format";
import { useLoad } from "../../hooks";
import type { Student } from "../../types";
import { check, FIELD_MESSAGES, RULES } from "../../validation";

export function Students() {
  const data = useLoad(async () => {
    const [students, routes, schools, guardians] = await Promise.all([
      api.students(),
      api.routes(),
      api.schools(),
      api.users("guardian"),
    ]);
    return { students, routes, schools, guardians };
  }, []);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Student[] | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);

  // Search by name or last name with the AVL index of the API (prefix search).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api.searchStudents(q).then(setFound).catch(() => setFound([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;

  const { students, routes, schools } = data.data;
  const list = found ?? students;
  const routeName = (id: number | null) => routes.find((r) => r.id === id)?.name ?? "Sin ruta";

  return (
    <>
      <PageHeader title="Estudiantes">
        <button type="button" className="button button-primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cerrar formulario" : "Registrar estudiante"}
        </button>
      </PageHeader>

      {creating && (
        <StudentForm
          data={data.data}
          onCreated={async (student) => {
            setCreating(false);
            await data.reload(true);
            setSelected(student);
          }}
        />
      )}

      <label className="field search">
        <span>Buscar por nombre o apellido</span>
        <input
          type="search"
          value={query}
          maxLength={40}
          placeholder="Ej.: val, pérez…"
          onChange={(e) => setQuery(e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü ]/g, ""))}
        />
        <small className="field-hint">Búsqueda por prefijo con un árbol AVL (sin importar tildes).</small>
      </label>

      <div className="split">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Grado</th>
                <th>Ruta</th>
                <th>Carnet</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={selected?.id === s.id ? "is-selected" : ""}>
                  <td>
                    <button type="button" className="link-button" onClick={() => setSelected(s)}>
                      {s.full_name}
                    </button>
                    <br />
                    <small className="muted">
                      {s.document_type.code.toUpperCase()} {s.document_number} · {age(s.birth_date)} años
                    </small>
                  </td>
                  <td>{s.grade.name}</td>
                  <td>{routeName(s.route_id)}</td>
                  <td>
                    <code>{s.qr_code}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="table-empty muted">Sin resultados.</p>}
        </div>

        {selected && (
          <StudentDetail
            key={selected.id}
            student={selected}
            routeName={routeName(selected.route_id)}
            schoolName={schools[0]?.name}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}

function StudentDetail({
  student,
  routeName,
  schoolName,
  onClose,
}: {
  student: Student;
  routeName: string;
  schoolName?: string;
  onClose: () => void;
}) {
  const detail = useLoad(async () => {
    const [history, risk, stops] = await Promise.all([
      api.history(student.id, 10),
      api.absenceRisk(student.id),
      student.route_id ? api.stops(student.route_id) : Promise.resolve([]),
    ]);
    return { history, risk, stops };
  }, [student.id]);
  const stopName = detail.data?.stops.find((s) => s.id === student.stop_id)?.name;

  return (
    <aside className="panel detail">
      <div className="detail-head">
        <h2>{student.full_name}</h2>
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="printable">
        <QrCard student={student} routeName={routeName} stopName={stopName} schoolName={schoolName} />
      </div>
      <button type="button" className="button button-quiet" onClick={() => window.print()}>
        Imprimir carnet
      </button>

      <h3>Acudientes</h3>
      <ul className="plain-list">
        {student.guardians.map((g) => (
          <li key={g.guardian_id} className="list-row">
            <span>
              {g.full_name}
              <small>
                {g.relationship}
                {g.is_primary ? " · principal" : ""} · {g.phone}
              </small>
            </span>
          </li>
        ))}
      </ul>

      {detail.data && (
        <>
          <h3>Riesgo de inasistencia (IA)</h3>
          <p>
            <RiskPill risk={detail.data.risk.risk} label={RISK_LABEL[detail.data.risk.risk]} />{" "}
            <span className="muted">{detail.data.risk.explanation}</span>
          </p>
          <h3>Últimos movimientos</h3>
          {detail.data.history.length === 0 ? (
            <p className="muted">Sin registros.</p>
          ) : (
            <ul className="plain-list">
              {detail.data.history.map((e) => (
                <li key={e.id} className="list-row">
                  <span>
                    {e.event_type.name}
                    <small>
                      {formatDateTime(e.timestamp)} · {e.method.name}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------

type FormData = {
  routes: { id: number; name: string; campus_id: number }[];
  schools: { campuses: { id: number; name: string }[] }[];
  guardians: { id: number; first_name: string; last_name: string; document_number: string }[];
};

interface GuardianRow {
  guardian_id: string;
  relationship_code: string;
}

function StudentForm({ data, onCreated }: { data: FormData; onCreated: (s: Student) => void }) {
  const documentTypes = useCatalog("document_types");
  const grades = [...useCatalog("grades")].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const relationships = useCatalog("relationships");
  const campuses = data.schools.flatMap((s) => s.campuses);

  const [docType, setDocType] = useState("ti");
  const [docNumber, setDocNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [grade, setGrade] = useState("");
  const [campusId, setCampusId] = useState(String(campuses[0]?.id ?? ""));
  const [routeId, setRouteId] = useState("");
  const [stopId, setStopId] = useState("");
  const [guardians, setGuardians] = useState<GuardianRow[]>([{ guardian_id: "", relationship_code: "" }]);
  const [primary, setPrimary] = useState(0);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stops = useLoad(() => (routeId ? api.stops(Number(routeId)) : Promise.resolve([])), [routeId]);
  const pickupStops = (stops.data ?? []).slice(0, -1); // the last stop is the school

  // Allowed ages: 3 to 20 years (the API checks the same).
  const bounds = useMemo(() => {
    const now = new Date();
    const iso = (years: number) => new Date(now.getFullYear() - years, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    return { min: iso(20), max: iso(3) };
  }, []);

  const problems = [
    check(RULES.document, docNumber),
    check(RULES.personName, firstName),
    check(RULES.personName, lastName),
    !birthDate || birthDate < bounds.min || birthDate > bounds.max ? "La edad debe estar entre 3 y 20 años." : null,
    !grade ? "Seleccione el grado." : null,
    !campusId ? "Seleccione la sede." : null,
    routeId && !stopId ? "Seleccione la parada donde sube el estudiante." : null,
    guardians.some((g) => !g.guardian_id || !g.relationship_code) ? "Complete los datos de cada acudiente." : null,
    new Set(guardians.map((g) => g.guardian_id)).size !== guardians.length ? "Un acudiente está repetido." : null,
  ].filter(Boolean) as string[];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problems.length) return;
    setBusy(true);
    setError(null);
    const payload: NewStudent = {
      document_type_code: docType,
      document_number: docNumber,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_date: birthDate,
      grade_code: grade,
      campus_id: Number(campusId),
      route_id: routeId ? Number(routeId) : null,
      stop_id: stopId ? Number(stopId) : null,
      guardians: guardians.map((g, i) => ({
        guardian_id: Number(g.guardian_id),
        relationship_code: g.relationship_code,
        is_primary: i === primary,
      })),
    };
    try {
      onCreated(await api.createStudent(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2>Nuevo estudiante</h2>
      <div className="form-grid">
        <SelectField
          label="Tipo de documento"
          value={docType}
          onChange={setDocType}
          options={documentTypes.map((d) => ({ value: d.code, label: d.name }))}
        />
        <TextField label="Número de documento" rule={RULES.document} value={docNumber} onChange={setDocNumber} inputMode="numeric" showErrors={tried} />
        <TextField label="Nombres" rule={RULES.personName} value={firstName} onChange={setFirstName} autoComplete="off" showErrors={tried} />
        <TextField label="Apellidos" rule={RULES.personName} value={lastName} onChange={setLastName} autoComplete="off" showErrors={tried} />
        <label className="field">
          <span className="field-label">Fecha de nacimiento</span>
          <input type="date" value={birthDate} min={bounds.min} max={bounds.max} required onChange={(e) => setBirthDate(e.target.value)} />
          <small className="field-hint">Entre 3 y 20 años de edad.</small>
        </label>
        <SelectField
          label="Grado"
          value={grade}
          onChange={setGrade}
          placeholder="Seleccione…"
          options={grades.map((g) => ({ value: g.code, label: g.name }))}
        />
        <SelectField label="Sede" value={campusId} onChange={setCampusId} options={campuses.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField
          label="Ruta"
          required={false}
          value={routeId}
          onChange={(v) => {
            setRouteId(v);
            setStopId("");
          }}
          placeholder="Sin ruta"
          options={data.routes.filter((r) => String(r.campus_id) === campusId).map((r) => ({ value: r.id, label: r.name }))}
        />
        <SelectField
          label="Parada"
          value={stopId}
          onChange={setStopId}
          required={Boolean(routeId)}
          disabled={!routeId}
          placeholder="Seleccione…"
          options={pickupStops.map((s) => ({ value: s.id, label: `${s.order}. ${s.name}` }))}
        />
      </div>

      <fieldset className="fieldset">
        <legend>Acudientes (1 a 4)</legend>
        {guardians.map((row, index) => (
          <div key={index} className="guardian-row">
            <SelectField
              label={`Acudiente ${index + 1}`}
              value={row.guardian_id}
              placeholder="Seleccione…"
              onChange={(v) => setGuardians((list) => list.map((g, i) => (i === index ? { ...g, guardian_id: v } : g)))}
              options={data.guardians.map((g) => ({ value: g.id, label: `${g.first_name} ${g.last_name} · ${g.document_number}` }))}
            />
            <SelectField
              label="Parentesco"
              value={row.relationship_code}
              placeholder="Seleccione…"
              onChange={(v) => setGuardians((list) => list.map((g, i) => (i === index ? { ...g, relationship_code: v } : g)))}
              options={relationships.map((r) => ({ value: r.code, label: r.name }))}
            />
            <label className="radio">
              <input type="radio" name="primary" checked={primary === index} onChange={() => setPrimary(index)} /> Principal
            </label>
            {guardians.length > 1 && (
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setGuardians((list) => list.filter((_, i) => i !== index));
                  setPrimary(0);
                }}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        {guardians.length < 4 && (
          <button type="button" className="button button-quiet" onClick={() => setGuardians((l) => [...l, { guardian_id: "", relationship_code: "" }])}>
            + Agregar acudiente
          </button>
        )}
        <small className="field-hint">Si el acudiente no aparece, créelo primero en Usuarios con el rol Acudiente.</small>
      </fieldset>

      {tried && problems.length > 0 && (
        <Notice kind="error">
          Revise los campos marcados en rojo.{" "}
          {[...new Set(problems.filter((p) => !FIELD_MESSAGES.has(p)))].join(" ")}
        </Notice>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <span className="muted">El código QR del carnet se genera automáticamente.</span>
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? "Guardando…" : "Registrar estudiante"}
        </button>
      </div>
    </form>
  );
}
