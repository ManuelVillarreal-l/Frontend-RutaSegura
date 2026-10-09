// Incidents, audit log and the data structures used by the system.

import { useState } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, PageHeader } from "../../components/Feedback";
import { formatDateTime } from "../../format";
import { useLoad } from "../../hooks";
import type { TreeNode } from "../../types";

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

export function Structures() {
  const data = useLoad(async () => {
    const [structures, tree] = await Promise.all([api.structures(), api.schoolTree()]);
    return { structures, tree };
  }, []);

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />;

  return (
    <>
      <PageHeader title="Estructuras de datos" />
      <p className="lead">
        Las 10 estructuras están implementadas a mano en el servidor (carpeta <code>app/structures</code>) y cada una
        resuelve una tarea real de la aplicación.
      </p>
      <div className="structure-grid">
        {data.data.structures.map((s) => (
          <article key={s.name} className="panel structure">
            <h3>{s.name}</h3>
            <p>{s.use}</p>
            <p className="muted small">
              <code>{s.file}</code> · {s.complexity}
            </p>
            <p className="small">
              <code>{s.endpoint}</code>
            </p>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Árbol n-ario: institución → sede → grado → estudiantes</h2>
        <p className="muted">{data.data.tree.total_leaves} estudiantes (hojas del árbol).</p>
        <Tree node={data.data.tree.tree} />
      </section>
    </>
  );
}

function Tree({ node }: { node: TreeNode }) {
  return (
    <ul className="tree">
      <li>
        <span className={`tree-node tree-${node.data.type}`}>{node.name}</span>
        {node.children.length > 0 && node.children.map((child) => <Tree key={`${child.data.type}-${child.data.id}-${child.name}`} node={child} />)}
      </li>
    </ul>
  );
}
