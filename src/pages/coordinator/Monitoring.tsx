// Incidents and the audit log (who did what and when).

import { useState } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { formatDateTime } from "../../format";
import { useLoad } from "../../hooks";

export function Incidents() {
  const [openOnly, setOpenOnly] = useState(true);
  const data = useLoad(async () => {
    const [incidents, users] = await Promise.all([api.incidents(openOnly), api.users()]);
    return { incidents, users };
  }, [openOnly]);

  async function resolve(id: number) {
    await api.resolveIncident(id).catch(() => undefined);
    await data.reload(true);
  }

  return (
    <>
      <PageHeader title="Incidentes">
        <label className="switch">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          <span>Solo abiertos</span>
        </label>
      </PageHeader>
      {data.loading && !data.data ? (
        <Loading />
      ) : data.error || !data.data ? (
        <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />
      ) : data.data.incidents.length === 0 ? (
        <p className="muted">No hay incidentes{openOnly ? " abiertos" : ""}.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Reportó</th>
                <th>Fecha</th>
                <th className="cell-actions">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.data.incidents.map((i) => {
                const by = data.data!.users.find((u) => u.id === i.reported_by);
                return (
                  <tr key={i.id}>
                    <td>{i.incident_type.name}</td>
                    <td>
                      {i.description}
                      {i.latitude !== null && (
                        <>
                          <br />
                          <small className="muted">
                            GPS {i.latitude.toFixed(4)}, {i.longitude?.toFixed(4)}
                          </small>
                        </>
                      )}
                    </td>
                    <td>{by ? `${by.first_name} ${by.last_name}` : "—"}</td>
                    <td>{formatDateTime(i.created_at)}</td>
                    <td className="cell-actions">
                      {i.resolved_at ? (
                        <span className="pill pill-low">Resuelto {formatDateTime(i.resolved_at)}</span>
                      ) : (
                        <button type="button" className="button button-primary" onClick={() => void resolve(i.id)}>
                          Marcar resuelto
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  login: "Inició sesión",
  create: "Creó",
  update: "Actualizó",
  start: "Inició",
  finish: "Finalizó",
  undo: "Deshizo",
  boarding: "Registró abordaje",
  drop_off: "Registró descenso",
  resolve: "Resolvió",
  report: "Reportó",
  activate: "Activó",
  deactivate: "Desactivó",
};

const ENTITY_LABEL: Record<string, string> = {
  users: "usuario",
  drivers: "licencia",
  incidents: "incidente",
  routes: "ruta",
  stops: "parada",
  route_segments: "tramo",
  schools: "institución",
  campuses: "sede",
  vehicles: "vehículo",
  trips: "recorrido",
  attendance: "asistencia",
  students: "estudiante",
  weather_conditions: "clima",
  road_conditions: "estado de vía",
};

export function Audit() {
  const data = useLoad(() => api.audit(150), []);
  return (
    <>
      <PageHeader title="Auditoría" />
      <p className="lead">Quién hizo qué y cuándo. Los registros no se pueden editar desde la aplicación.</p>
      {data.loading && !data.data ? (
        <Loading />
      ) : data.error || !data.data ? (
        <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.user}</td>
                  <td>
                    {ACTION_LABEL[row.action] ?? row.action} <small className="muted">({ENTITY_LABEL[row.entity] ?? row.entity})</small>
                  </td>
                  <td>{row.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

