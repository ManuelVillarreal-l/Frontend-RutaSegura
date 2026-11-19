// Small form to create a campus (sede) of a school. Used in Fleet and in Routes, so a new
// campus can be added right where it is needed instead of being fixed in the code.

import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { Campus, School } from "../types";
import { check, RULES } from "../validation";
import { SelectField, TextField } from "./Fields";

export function CampusForm({
  schools,
  onCreated,
  onCancel,
}: {
  schools: School[];
  onCreated: (campus: Campus) => void;
  onCancel?: () => void;
}) {
  const [schoolId, setSchoolId] = useState(String(schools[0]?.id ?? ""));
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!schoolId || check(RULES.label, name) || (address && check(RULES.label, address))) return;
    setSaving(true);
    setError(null);
    try {
      const campus = await api.createCampus({
        school_id: Number(schoolId),
        name: name.trim(),
        address: address.trim() || null,
      });
      setName("");
      setAddress("");
      setTried(false);
      onCreated(campus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sede.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form subform" onSubmit={submit} noValidate>
      <h3>Nueva sede</h3>
      <div className="form-grid">
        {schools.length > 1 && (
          <SelectField
            label="Institución"
            value={schoolId}
            onChange={setSchoolId}
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
        <TextField label="Nombre de la sede" rule={RULES.label} value={name} onChange={setName} placeholder="Sede Cali" showErrors={tried} />
        <TextField
          label="Dirección o vereda"
          rule={RULES.label}
          value={address}
          onChange={setAddress}
          placeholder="Vereda La Buitrera"
          showErrors={tried && address !== ""}
          required={false}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="button-row">
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar sede"}
        </button>
        {onCancel && (
          <button type="button" className="button button-quiet" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
