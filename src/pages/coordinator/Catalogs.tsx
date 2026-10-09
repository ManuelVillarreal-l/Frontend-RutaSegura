// Catalogs: every list of options lives in a database table. Weather and road
// conditions can be added or edited here without touching the code.

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useSession } from "../../auth";
import { Notice, PageHeader } from "../../components/Feedback";
import { isValidNumber, NumberField, TextField } from "../../components/Fields";
import type { CatalogItem, CatalogName } from "../../types";
import { check, RULES } from "../../validation";

const EDITABLE: { name: CatalogName; title: string; withCodes: boolean }[] = [
  { name: "weather_conditions", title: "Climas", withCodes: true },
  { name: "road_conditions", title: "Estados de la vía", withCodes: false },
];

const READ_ONLY: { name: CatalogName; title: string }[] = [
  { name: "roles", title: "Roles" },
  { name: "document_types", title: "Tipos de documento" },
  { name: "grades", title: "Grados" },
  { name: "relationships", title: "Parentescos" },
  { name: "trip_statuses", title: "Estados del recorrido" },
  { name: "event_types", title: "Tipos de evento" },
  { name: "check_in_methods", title: "Métodos de registro" },
  { name: "incident_types", title: "Tipos de incidente" },
];

export function Catalogs() {
  const { catalogs, reloadCatalogs } = useSession();
  if (!catalogs) return null;

  return (
    <>
      <PageHeader title="Catálogos" />
      <p className="lead">
        Todas las opciones de la aplicación salen de tablas de la base de datos. Para agregar un clima o un estado de la
        vía no hay que cambiar el código: se agrega aquí y queda disponible para conductores, reportes y la IA.
      </p>
      <div className="columns">
        {EDITABLE.map((c) => (
          <EditableCatalog key={c.name} {...c} items={catalogs[c.name]} onChanged={reloadCatalogs} />
        ))}
      </div>
      <h2 className="spaced">Otros catálogos</h2>
      <div className="catalog-grid">
        {READ_ONLY.map((c) => (
          <section key={c.name} className="panel">
            <h3>{c.title}</h3>
            <ul className="tag-list">
              {catalogs[c.name].map((item) => (
                <li key={item.id} className="tag" title={item.code}>
                  {item.name}
                  {item.severity ? ` · gravedad ${item.severity}` : ""}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function EditableCatalog({
  name,
  title,
  withCodes,
  items,
  onChanged,
}: {
  name: CatalogName;
  title: string;
  withCodes: boolean;
  items: CatalogItem[];
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggle(item: CatalogItem) {
    try {
      await api.updateCondition(name, item.id, { active: !item.active });
      await onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo cambiar." });
    }
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Retraso</th>
              {withCodes && <th>Códigos Open-Meteo</th>}
              <th className="cell-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) =>
              editing === item.id ? (
                <tr key={item.id}>
                  <td colSpan={withCodes ? 4 : 3}>
                    <ConditionForm
                      name={name}
                      withCodes={withCodes}
                      item={item}
                      onDone={async (text) => {
                        setEditing(null);
                        if (text) {
                          setMessage({ ok: true, text });
                          await onChanged();
                        }
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={item.id} className={item.active ? "" : "is-inactive"}>
                  <td>
                    {item.name}
                    <br />
                    <small className="muted">{item.code}</small>
                  </td>
                  <td>+{item.delay_minutes} min</td>
                  {withCodes && <td>{item.weather_codes || "—"}</td>}
                  <td className="cell-actions">
                    <button type="button" className="button button-quiet" onClick={() => setEditing(item.id)}>
                      Editar
                    </button>{" "}
                    <button type="button" className="button button-quiet" onClick={() => void toggle(item)}>
                      {item.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {message && <Notice kind={message.ok ? "success" : "error"}>{message.text}</Notice>}
      {editing === null && (
        <ConditionForm
          name={name}
          withCodes={withCodes}
          onDone={async (text) => {
            if (text) {
              setMessage({ ok: true, text });
              await onChanged();
            }
          }}
        />
      )}
    </section>
  );
}

function ConditionForm({
  name,
  withCodes,
  item,
  onDone,
}: {
  name: CatalogName;
  withCodes: boolean;
  item?: CatalogItem;
  onDone: (message: string | null) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [label, setLabel] = useState(item?.name ?? "");
  const [delay, setDelay] = useState(item ? String(item.delay_minutes ?? 0) : "");
  const [codes, setCodes] = useState(item?.weather_codes ?? "");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (
      (!item && check(RULES.code, code)) ||
      check(RULES.catalogName, label) ||
      !isValidNumber(delay, 0, 120) ||
      (withCodes && check(RULES.weatherCodes, codes, false))
    )
      return;
    setError(null);
    try {
      const weather_codes = withCodes ? codes || null : undefined;
      if (item) {
        await api.updateCondition(name, item.id, { name: label.trim(), delay_minutes: Number(delay), weather_codes });
        onDone(`"${label}" actualizado.`);
      } else {
        await api.createCondition(name, { code, name: label.trim(), delay_minutes: Number(delay), weather_codes });
        setCode("");
        setLabel("");
        setDelay("");
        setCodes("");
        setTried(false);
        onDone(`"${label}" agregado a la base de datos.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <form className="form subform" onSubmit={submit} noValidate>
      {!item && <h3>Agregar</h3>}
      <div className="form-grid">
        {!item && (
          <TextField label="Código interno" rule={RULES.code} value={code} onChange={setCode} placeholder="heavy_rain" showErrors={tried} />
        )}
        <TextField label="Nombre visible" rule={RULES.catalogName} value={label} onChange={setLabel} placeholder="Granizo" showErrors={tried} />
        <NumberField label="Minutos de retraso" value={delay} onChange={setDelay} min={0} max={120} hint="Entre 0 y 120." />
        {withCodes && (
          <TextField
            label="Códigos Open-Meteo"
            rule={RULES.weatherCodes}
            required={false}
            value={codes}
            onChange={setCodes}
            placeholder="77,85,86"
            hint="Para detectar este clima automáticamente con el GPS."
            showErrors={tried}
          />
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="button-row">
        <button type="submit" className="button button-primary">
          {item ? "Guardar cambios" : "Agregar"}
        </button>
        {item && (
          <button type="button" className="button button-quiet" onClick={() => onDone(null)}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
