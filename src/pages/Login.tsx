import { useState, type FormEvent } from "react";
import { useSession } from "../auth";
import { PasswordField, TextField } from "../components/Fields";
import { Brand, useSlowServer } from "../components/Layout";
import { check, PASSWORD_MAX, RULES } from "../validation";

const DEMO_ACCOUNTS = [
  { label: "Coordinador", email: "admin@rutasegura.com", password: "Admin123*" },
  { label: "Conductor", email: "conductor@rutasegura.com", password: "Conductor123*" },
  { label: "Monitor", email: "monitor@rutasegura.com", password: "Monitor123*" },
  { label: "Acudiente", email: "acudiente@rutasegura.com", password: "Acudiente123*" },
];

export function Login() {
  const { login, endedReason } = useSession();
  const slow = useSlowServer();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (check(RULES.email, email)) return;
    if (!password || password.length > PASSWORD_MAX) {
      setError("Escriba su contraseña (máximo 64 caracteres).");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
      setPassword("");
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
          Abordaje con código QR desde la cámara, bus en el mapa en tiempo real, avisos a los acudientes cuando el bus se
          acerca y predicción de retrasos con inteligencia artificial según el clima y el estado de la vía.
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
        <form className="form login-form" onSubmit={submit} noValidate>
          <h2>Iniciar sesión</h2>
          {endedReason && <p className="notice">{endedReason}</p>}
          <TextField
            label="Correo"
            rule={RULES.email}
            value={email}
            onChange={setEmail}
            type="email"
            inputMode="email"
            autoComplete="username"
            showErrors={tried}
          />
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {slow && <p className="muted">El servidor está despertando, espere un momento…</p>}
          <button type="submit" className="button button-primary button-block" disabled={sending}>
            {sending ? "Entrando…" : "Entrar"}
          </button>
          <p className="muted small">Por seguridad la sesión se cierra sola a los 30 minutos.</p>
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
                  setError(null);
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
