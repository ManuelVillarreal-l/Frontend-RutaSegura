import { useState, type FormEvent } from "react";
import { useSession } from "../auth";
import { Brand, useSlowServer } from "../components/Layout";

const DEMO_ACCOUNTS = [
  { label: "Coordinador", email: "admin@rutasegura.com", password: "Admin123*" },
  { label: "Conductor", email: "conductor@rutasegura.com", password: "Conductor123*" },
  { label: "Acudiente", email: "acudiente@rutasegura.com", password: "Acudiente123*" },
];

export function Login() {
  const { login } = useSession();
  const slow = useSlowServer();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="login">
      <section className="login-intro">
        <Brand />
        <h1>Cada estudiante, de su vereda al colegio y de vuelta a casa.</h1>
        <p>
          Registro de abordaje y descenso con código QR, seguimiento de cada recorrido y consulta para los acudientes
          en el transporte escolar rural.
        </p>
        <svg className="login-road" viewBox="0 0 400 120" aria-hidden="true">
          <path d="M0 90 C 90 90, 110 30, 200 30 S 310 90, 400 90" fill="none" stroke="#F3F6F2" strokeOpacity=".35" strokeWidth="18" strokeLinecap="round" />
          <path d="M0 90 C 90 90, 110 30, 200 30 S 310 90, 400 90" fill="none" stroke="#F2B705" strokeWidth="3" strokeDasharray="10 12" />
          <circle cx="60" cy="88" r="7" fill="#F3F6F2" />
          <circle cx="200" cy="30" r="7" fill="#F3F6F2" />
          <circle cx="340" cy="88" r="7" fill="#F3F6F2" />
        </svg>
      </section>

      <section className="login-panel">
        <form className="form login-form" onSubmit={submit}>
          <h2>Iniciar sesión</h2>
          <label className="field">
            <span>Correo</span>
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {slow && <p className="muted">El servidor está despertando, espere un momento…</p>}
          <button type="submit" className="button button-primary button-block" disabled={sending}>
            {sending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="demo-accounts">
          <p className="muted">Cuentas de prueba:</p>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
