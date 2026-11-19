// Campuses, fleet and drivers. Every bus and every driver belongs to a campus (sede), so a
// route or a trip of a campus only offers its own buses and drivers. Nothing is fixed in the
// code: campuses, buses and licenses are created here and saved in the database.
// The driver rotation uses a circular doubly linked list.

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { CampusForm } from "../../components/CampusForm";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { isValidNumber, NumberField, SelectField, TextField } from "../../components/Fields";
import { useLoad } from "../../hooks";
import type { Campus, Vehicle } from "../../types";
import { check, RULES } from "../../validation";

const CATEGORIES = ["B1", "B2", "B3", "C1", "C2", "C3"];

export function Fleet() {
  const data = useLoad(async () => {
    const [schools, vehicles, drivers, driverUsers] = await Promise.all([
      api.schools(),
      api.vehicles(),
      api.drivers(),
      api.users("driver"),
    ]);
    return { schools, vehicles, drivers, driverUsers };
  }, []);
  const [campusFilter, setCampusFilter] = useState("");
  const [addingCampus, setAddingCampus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rotationOf, setRotationOf] = useState<number | null>(null);
  const rotation = useLoad(
    () => (rotationOf ? api.driverRotation(rotationOf) : Promise.resolve(null)),
    [rotationOf],
  );

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;
  const { schools, vehicles, drivers, driverUsers } = data.data;
  const campuses = schools.flatMap((s) => s.campuses);
  const withoutLicense = driverUsers.filter((u) => u.active && !drivers.some((d) => d.user_id === u.id));
  const byCampus = <T extends { campus_id: number | null }>(list: T[]) =>
    campusFilter ? list.filter((item) => String(item.campus_id) === campusFilter) : list;

  async function toggleVehicle(vehicle: Vehicle) {
    try {
      await api.setVehicleActive(vehicle.id, !vehicle.active);
      setMessage(`Vehículo ${vehicle.plate} ${vehicle.active ? "desactivado" : "activado"}.`);
      await data.reload(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <>
      <PageHeader title="Sedes, flota y conductores" />
      {message && <Notice kind="success">{message}</Notice>}

      <section className="panel">
        <div className="panel-head">
          <h2>Sedes</h2>
          <button type="button" className="button button-primary" onClick={() => setAddingCampus((v) => !v)}>
            {addingCampus ? "Cerrar" : "+ Nueva sede"}
          </button>
        </div>
        <div className="campus-cards">
          {campuses.map((c) => (
            <CampusCard
              key={c.id}
              campus={c}
              buses={vehicles.filter((v) => v.campus_id === c.id).length}
              drivers={drivers.filter((d) => d.campus_id === c.id).length}
              selected={campusFilter === String(c.id)}
              onSelect={() => setCampusFilter((current) => (current === String(c.id) ? "" : String(c.id)))}
            />
          ))}
        </div>
        <p className="muted small">Toque una sede para ver solo sus buses y conductores.</p>
        {addingCampus && (
          <CampusForm
            schools={schools}
            onCancel={() => setAddingCampus(false)}
            onCreated={async (campus) => {
              setAddingCampus(false);
              setMessage(`«${campus.name}» creada. Ya puede agregarle buses, conductores y rutas.`);
              await data.reload(true);
              setCampusFilter(String(campus.id));
            }}
          />
        )}
      </section>

      <div className="columns">
        <section className="panel">
          <h2>Vehículos{campusFilter && ` · ${campuses.find((c) => String(c.id) === campusFilter)?.name}`}</h2>
          <ul className="plain-list">
            {byCampus(vehicles).map((v) => (
              <li key={v.id} className={`list-row ${v.active ? "" : "is-inactive"}`}>
                <span>
                  <strong className="plate">{v.plate}</strong>
                  <small>
                    {v.brand} {v.model_year} · {v.capacity} puestos · {v.campus_name ?? "Sin sede"}
                  </small>
                </span>
                <span className="row-actions">
                  <StatusBadge active={v.active} />
                  <button type="button" className="button button-quiet button-small" onClick={() => void toggleVehicle(v)}>
                    {v.active ? "Desactivar" : "Activar"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {byCampus(vehicles).length === 0 && <p className="muted">Esta sede todavía no tiene buses.</p>}
          {/* key: the form starts again on the campus selected above */}
          <VehicleForm
            key={`vehicle-${campusFilter}-${campuses.length}`}
            campuses={campuses}
            defaultCampus={campusFilter}
            onCreated={() => data.reload(true)}
          />
        </section>

        <section className="panel">
          <h2>Licencias de conducción</h2>
          <ul className="plain-list">
            {byCampus(drivers).map((d) => (
              <li key={d.id} className="list-row">
                <span>
                  {d.full_name}
                  <small>
                    {d.campus_name ?? "Sin sede"} · Licencia {d.license_number} · {d.license_category} · vence{" "}
                    {d.license_expires_on}
                    {d.vehicle_plate ? ` · bus ${d.vehicle_plate}` : ""}
                  </small>
                </span>
                <span className={`pill ${d.license_valid ? "pill-low" : "pill-high"}`}>{d.license_valid ? "Vigente" : "Vencida"}</span>
              </li>
            ))}
          </ul>
          {withoutLicense.length > 0 ? (
            <LicenseForm
              key={`license-${campusFilter}-${campuses.length}`}
              users={withoutLicense}
              vehicles={vehicles.filter((v) => v.active)}
              campuses={campuses}
              defaultCampus={campusFilter}
              onCreated={() => data.reload(true)}
            />
          ) : (
            <p className="muted small">
              Todos los conductores tienen licencia. Para agregar otro, créelo en Usuarios con el rol Conductor.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Rotación de conductores</h2>
          <p className="muted">
            Lista circular doblemente enlazada: desde cualquier conductor se pasa al siguiente o al anterior, y después del
            último vuelve el primero.
          </p>
          <SelectField
            label="Conductor de hoy"
            value={rotationOf ? String(rotationOf) : ""}
            onChange={(v) => setRotationOf(v ? Number(v) : null)}
            placeholder="Seleccione…"
            options={drivers.map((d) => ({ value: d.user_id, label: d.full_name }))}
          />
          {rotation.data && (
            <div className="ring">
              <span className="ring-item">
                <small>Anterior</small>
                {rotation.data.previous.full_name}
              </span>
              <span className="ring-item is-current">
                <small>Hoy</small>
                {rotation.data.current.full_name}
              </span>
              <span className="ring-item">
                <small>Siguiente</small>
                {rotation.data.next.full_name}
              </span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`status-badge ${active ? "is-active" : "is-inactive"}`}>
      <span aria-hidden="true">{active ? "✔" : "✖"}</span> {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function CampusCard({
  campus,
  buses,
  drivers,
  selected,
  onSelect,
}: {
  campus: Campus;
  buses: number;
  drivers: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={`campus-card ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
      <strong>{campus.name}</strong>
      <small>{campus.address ?? "Sin dirección"}</small>
      <span className="campus-counts">
        {buses} bus{buses === 1 ? "" : "es"} · {drivers} conductor{drivers === 1 ? "" : "es"}
      </span>
    </button>
  );
}

function VehicleForm({
  campuses,
  defaultCampus,
  onCreated,
}: {
  campuses: Campus[];
  defaultCampus: string;
  onCreated: () => void;
}) {
  const [campusId, setCampusId] = useState(defaultCampus || String(campuses[0]?.id ?? ""));
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const [capacity, setCapacity] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const thisYear = new Date().getFullYear() + 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    setSaved(null);
    if (!campusId || check(RULES.plate, plate) || check(RULES.label, brand)) return;
    if (!isValidNumber(year, 1990, thisYear)) {
      setError(`El modelo debe ser un año entre 1990 y ${thisYear}.`);
      return;
    }
    if (!isValidNumber(capacity, 1, 60)) {
      setError("Los puestos deben estar entre 1 y 60.");
      return;
    }
    setError(null);
    try {
      const vehicle = await api.createVehicle({
        plate,
        brand: brand.trim(),
        model_year: Number(year),
        capacity: Number(capacity),
        campus_id: Number(campusId),
      });
      setPlate("");
      setBrand("");
      setYear("");
      setCapacity("");
      setTried(false);
      setSaved(`Bus ${vehicle.plate} agregado a ${vehicle.campus_name}.`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <form className="form subform" onSubmit={submit} noValidate>
      <h3>Agregar vehículo</h3>
      <div className="form-grid">
        <SelectField label="Sede" value={campusId} onChange={setCampusId} options={campuses.map((c) => ({ value: c.id, label: c.name }))} />
        <TextField label="Placa" rule={RULES.plate} value={plate} onChange={setPlate} placeholder="ABC123" showErrors={tried} />
        <TextField label="Marca y línea" rule={RULES.label} value={brand} onChange={setBrand} placeholder="Chevrolet NPR" showErrors={tried} />
        <NumberField label="Modelo (año)" value={year} onChange={setYear} min={1990} max={thisYear} />
        <NumberField label="Puestos" value={capacity} onChange={setCapacity} min={1} max={60} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="form-success">{saved}</p>}
      <button type="submit" className="button button-primary">
        Guardar vehículo
      </button>
    </form>
  );
}

function LicenseForm({
  users,
  vehicles,
  campuses,
  defaultCampus,
  onCreated,
}: {
  users: { id: number; first_name: string; last_name: string }[];
  vehicles: Vehicle[];
  campuses: Campus[];
  defaultCampus: string;
  onCreated: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [campusId, setCampusId] = useState(defaultCampus || String(campuses[0]?.id ?? ""));
  const [number, setNumber] = useState("");
  const [category, setCategory] = useState("C1");
  const [expires, setExpires] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  // Only the buses of the chosen campus can be assigned.
  const campusVehicles = vehicles.filter((v) => String(v.campus_id) === campusId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!userId || !campusId || check(RULES.license, number) || !expires) return;
    if (expires < today) {
      setError("La licencia está vencida: la fecha de vencimiento debe ser hoy o una fecha futura.");
      return;
    }
    setError(null);
    try {
      await api.createDriver({
        user_id: Number(userId),
        license_number: number,
        license_category: category,
        license_expires_on: expires,
        vehicle_id: vehicleId ? Number(vehicleId) : null,
        campus_id: Number(campusId),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <form className="form subform" onSubmit={submit} noValidate>
      <h3>Registrar licencia</h3>
      <div className="form-grid">
        <SelectField
          label="Conductor"
          value={userId}
          onChange={setUserId}
          placeholder="Seleccione…"
          options={users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
        />
        <SelectField
          label="Sede donde trabaja"
          value={campusId}
          onChange={(v) => {
            setCampusId(v);
            setVehicleId("");
          }}
          options={campuses.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextField label="Número de licencia" rule={RULES.license} value={number} onChange={setNumber} inputMode="numeric" showErrors={tried} />
        <SelectField label="Categoría" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <label className="field">
          <span className="field-label">Vence</span>
          <input type="date" value={expires} min={today} required onChange={(e) => setExpires(e.target.value)} />
        </label>
        <SelectField
          label="Bus asignado"
          required={false}
          value={vehicleId}
          onChange={setVehicleId}
          placeholder={campusVehicles.length ? "Ninguno" : "La sede no tiene buses"}
          options={campusVehicles.map((v) => ({ value: v.id, label: `${v.plate} · ${v.brand}` }))}
        />
      </div>
      {tried && (!userId || !expires) && <Notice kind="error">Complete conductor y fecha de vencimiento.</Notice>}
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary">
        Guardar licencia
      </button>
    </form>
  );
}
