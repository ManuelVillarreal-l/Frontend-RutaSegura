// Users: only the coordinator creates accounts. The role comes from the roles table
// and the password is checked against the policy and hashed before being sent.

import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useCatalog } from "../../auth";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { PasswordField, SelectField, TextField } from "../../components/Fields";
import { formatDateTime } from "../../format";
import { useLoad } from "../../hooks";
import { check, FIELD_MESSAGES, passwordProblems, RULES } from "../../validation";

export function Users() {
  const roles = useCatalog("roles");
  const [role, setRole] = useState("");
  const users = useLoad(() => api.users(role || undefined), [role]);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(id: number, active: boolean) {
    try {
      await api.setUserActive(id, active);
      await users.reload(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <>
      <PageHeader title="Usuarios">
        <button type="button" className="button button-primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cerrar formulario" : "Crear usuario"}
        </button>
      </PageHeader>

      {creating && (
        <UserForm
          onCreated={async (name) => {
            setCreating(false);
            setMessage(`Usuario ${name} creado.`);
            await users.reload(true);
          }}
        />
      )}
      {message && <Notice kind="success">{message}</Notice>}

      <div className="segmented" role="tablist" aria-label="Filtrar por rol">
        <button type="button" role="tab" aria-selected={role === ""} className="segmented-item" onClick={() => setRole("")}>
          Todos
        </button>
        {roles.map((r) => (
          <button key={r.code} type="button" role="tab" aria-selected={role === r.code} className="segmented-item" onClick={() => setRole(r.code)}>
            {r.name}
          </button>
        ))}
      </div>

      {users.loading && !users.data ? (
        <Loading />
      ) : users.error ? (
        <ErrorBox message={users.error} onRetry={users.reload} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Documento</th>
                <th>Contacto</th>
                <th>Último ingreso</th>
                <th className="cell-actions">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.first_name} {u.last_name}
                  </td>
                  <td>{u.role.name}</td>
                  <td>
                    {u.document_type.code.toUpperCase()} {u.document_number}
                  </td>
                  <td>
                    {u.email}
                    <br />
                    <small className="muted">{u.phone}</small>
                  </td>
                  <td>{formatDateTime(u.last_login_at)}</td>
                  <td className="cell-actions">
                    <button type="button" className="button button-quiet" onClick={() => void toggle(u.id, !u.active)}>
                      {u.active ? "Activo · desactivar" : "Inactivo · activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function UserForm({ onCreated }: { onCreated: (name: string) => void }) {
  const roles = useCatalog("roles");
  const documentTypes = useCatalog("document_types").filter((d) => d.code === "cc" || d.code === "ce");
  const [role, setRole] = useState("guardian");
  const [docType, setDocType] = useState("cc");
  const [docNumber, setDocNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problems = [
    check(RULES.document, docNumber),
    check(RULES.personName, firstName),
    check(RULES.personName, lastName),
    check(RULES.email, email),
    check(RULES.phone, phone),
    passwordProblems(password).length ? "La contraseña no cumple los requisitos." : null,
    password !== confirm ? "Las contraseñas no coinciden." : null,
  ].filter(Boolean) as string[];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (problems.length) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.createUser({
        role_code: role,
        document_type_code: docType,
        document_number: docNumber,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email,
        phone,
        password,
      });
      setPassword("");
      setConfirm("");
      onCreated(`${user.first_name} ${user.last_name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit} noValidate autoComplete="off">
      <h2>Nuevo usuario</h2>
      <div className="form-grid">
        <SelectField label="Rol" value={role} onChange={setRole} options={roles.map((r) => ({ value: r.code, label: r.name }))} />
        <SelectField
          label="Tipo de documento"
          value={docType}
          onChange={setDocType}
          options={documentTypes.map((d) => ({ value: d.code, label: d.name }))}
        />
        <TextField label="Número de documento" rule={RULES.document} value={docNumber} onChange={setDocNumber} inputMode="numeric" showErrors={tried} />
        <TextField label="Nombres" rule={RULES.personName} value={firstName} onChange={setFirstName} showErrors={tried} />
        <TextField label="Apellidos" rule={RULES.personName} value={lastName} onChange={setLastName} showErrors={tried} />
        <TextField label="Correo" rule={RULES.email} value={email} onChange={setEmail} type="email" inputMode="email" showErrors={tried} />
        <TextField label="Celular" rule={RULES.phone} value={phone} onChange={setPhone} inputMode="tel" placeholder="3001234567" showErrors={tried} />
      </div>
      <div className="form-grid">
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" withPolicy />
        <div className="field">
          <PasswordField label="Repita la contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {confirm && confirm !== password && <small className="field-error">Las contraseñas no coinciden.</small>}
        </div>
      </div>
      {tried && problems.length > 0 && (
        <Notice kind="error">
          Revise los campos marcados en rojo.{" "}
          {[...new Set(problems.filter((p) => !FIELD_MESSAGES.has(p)))].join(" ")}
        </Notice>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <span className="muted">Se guarda solo un hash irreversible; nadie puede ver la contraseña.</span>
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
