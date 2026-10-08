// Coordinator: users of the system and a form to create new ones.

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { ROLE_LABEL } from "../../format";
import type { Role } from "../../types";
import { useLoad } from "../../useLoad";

const ROLES: Role[] = ["guardian", "driver", "monitor", "coordinator"];

export function Users() {
  const { data, error, loading, reload } = useLoad(() => api.users(), []);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Error"} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Usuarios">
        <button type="button" className="button button-primary" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
          {showForm ? "Cerrar formulario" : "Crear usuario"}
        </button>
      </PageHeader>

      {showForm && (
        <UserForm
          onCreated={(name) => {
            setCreated(`Se creó la cuenta de ${name}.`);
            setShowForm(false);
            void reload();
          }}
        />
      )}
      {created && <Notice kind="success">{created}</Notice>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABEL[user.role]}</td>
                <td>{user.active ? "Activo" : "Inactivo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserForm({ onCreated }: { onCreated: (name: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "guardian" as Role });
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const user = await api.register({ ...form, name: form.name.trim(), email: form.email.trim() });
      onCreated(user.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    }
  }

  return (
    <form className="panel form form-grid" onSubmit={submit}>
      <label className="field">
        <span>Nombre</span>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Correo</span>
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label className="field">
        <span>Contraseña (mínimo 6 caracteres)</span>
        <input type="password" minLength={6} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      <label className="field">
        <span>Rol</span>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABEL[role]}</option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary">Crear usuario</button>
      </div>
    </form>
  );
}



