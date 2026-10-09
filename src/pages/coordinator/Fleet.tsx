// Fleet: vehicles, driver licenses and the driver rotation (circular doubly linked list).

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { isValidNumber, NumberField, SelectField, TextField } from "../../components/Fields";
import { useLoad } from "../../hooks";
import { check, RULES } from "../../validation";

const CATEGORIES = ["B1", "B2", "B3", "C1", "C2", "C3"];

export function Fleet() {
  const data = useLoad(async () => {
    const [vehicles, drivers, driverUsers] = await Promise.all([api.vehicles(), api.drivers(), api.users("driver")]);
    return { vehicles, drivers, driverUsers };
  }, []);
  const [rotationOf, setRotationOf] = useState<number | null>(null);
  const rotation = useLoad(
    () => (rotationOf ? api.driverRotation(rotationOf) : Promise.resolve(null)),
    [rotationOf],
  );

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;
  const { vehicles, drivers, driverUsers } = data.data;
  const withoutLicense = driverUsers.filter((u) => !drivers.some((d) => d.user_id === u.id));

  return (
    <>
      <PageHeader title="Flota y conductores" />
      <div className="columns">
        <section className="panel">
          <h2>Vehículos</h2>
          <ul className="plain-list">
            {vehicles.map((v) => (
              <li key={v.id} className="list-row">
                <span>
                  <strong className="plate">{v.plate}</strong>
                  <small>
                    {v.brand} {v.model_year} · {v.capacity} puestos
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <VehicleForm onCreated={() => data.reload(true)} />
        </section>

        <section className="panel">
          <h2>Licencias de conducción</h2>
          <ul className="plain-list">
            {drivers.map((d) => (
              <li key={d.id} className="list-row">
                <span>
                  {d.full_name}
                  <small>
                    Licencia {d.license_number} · {d.license_category} · vence {d.license_expires_on}
                    {d.vehicle_plate ? ` · bus ${d.vehicle_plate}` : ""}
                  </small>
                </span>
                <span className={`pill ${d.license_valid ? "pill-low" : "pill-high"}`}>{d.license_valid ? "Vigente" : "Vencida"}</span>
              </li>
            ))}
          </ul>
          {withoutLicense.length > 0 && (
            <LicenseForm users={withoutLicense} vehicles={vehicles} onCreated={() => data.reload(true)} />
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

function VehicleForm({ onCreated }: { onCreated: () => void }) {
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const [capacity, setCapacity] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thisYear = new Date().getFullYear() + 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (check(RULES.plate, plate) || check(RULES.label, brand) || !isValidNumber(year, 1990, thisYear) || !isValidNumber(capacity, 1, 60)) return;
    setError(null);
    try {
      await api.createVehicle({ plate, brand: brand.trim(), model_year: Number(year), capacity: Number(capacity) });
      setPlate("");
      setBrand("");
      setYear("");
      setCapacity("");
      setTried(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <form className="form subform" onSubmit={submit} noValidate>
      <h3>Agregar vehículo</h3>
      <div className="form-grid">
        <TextField label="Placa" rule={RULES.plate} value={plate} onChange={setPlate} placeholder="ABC123" showErrors={tried} />
        <TextField label="Marca y línea" rule={RULES.label} value={brand} onChange={setBrand} placeholder="Chevrolet NPR" showErrors={tried} />
        <NumberField label="Modelo (año)" value={year} onChange={setYear} min={1990} max={thisYear} />
        <NumberField label="Puestos" value={capacity} onChange={setCapacity} min={1} max={60} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="button button-primary">
        Guardar vehículo
      </button>
    </form>
  );
}

function LicenseForm({
  users,
  vehicles,
  onCreated,
}: {
  users: { id: number; first_name: string; last_name: string }[];
  vehicles: { id: number; plate: string }[];
  onCreated: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [number, setNumber] = useState("");
  const [category, setCategory] = useState("C1");
  const [expires, setExpires] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!userId || check(RULES.license, number) || !expires) return;
    setError(null);
    try {
      await api.createDriver({
        user_id: Number(userId),
        license_number: number,
        license_category: category,
        license_expires_on: expires,
        vehicle_id: vehicleId ? Number(vehicleId) : null,
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
        <TextField label="Número de licencia" rule={RULES.license} value={number} onChange={setNumber} inputMode="numeric" showErrors={tried} />
        <SelectField label="Categoría" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <label className="field">
          <span className="field-label">Vence</span>
          <input type="date" value={expires} required onChange={(e) => setExpires(e.target.value)} />
        </label>
        <SelectField
          label="Vehículo asignado"
          required={false}
          value={vehicleId}
          onChange={setVehicleId}
          placeholder="Ninguno"
          options={vehicles.map((v) => ({ value: v.id, label: v.plate }))}
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
