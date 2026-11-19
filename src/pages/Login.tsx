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
        <div className="login-glow" aria-hidden="true" />
        <Brand />
        <h1>Cada estudiante, de su vereda al colegio y de vuelta a casa.</h1>
        <p>
          Abordaje con código QR desde la cámara, bus en el mapa en tiempo real, avisos a los acudientes cuando el bus se
          acerca y predicción de retrasos con inteligencia artificial según el clima y el estado de la vía.
        </p>
        <LoginScene />
      </section>

      <section className="login-panel">
        <div className="login-card">
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
        </div>
      </section>
    </div>
  );
}

// Animated scene: Andean ridges, the rural road with its stops and the school bus that
// travels it. Pure SVG + CSS; with "reduce motion" enabled the bus stays still.
const ROAD = "M-10 132 C 60 132, 80 96, 150 96 S 250 128, 300 110 S 380 70, 420 72";

function LoginScene() {
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg className="login-scene" viewBox="0 0 400 170" aria-hidden="true">
      <defs>
        <linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c7a5c" />
          <stop offset="1" stopColor="#2a5c45" />
        </linearGradient>
        <linearGradient id="ridge-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c6247" />
          <stop offset="1" stopColor="#1a3f2e" />
        </linearGradient>
      </defs>
      <circle className="scene-sun" cx="318" cy="38" r="18" fill="#F2B705" />
      <path d="M0 92 L48 60 L82 78 L130 40 L176 74 L214 52 L262 80 L300 58 L352 84 L400 62 L400 170 L0 170 Z" fill="url(#ridge-far)" opacity=".75" />
      <path d="M0 118 L56 92 L104 108 L160 84 L222 112 L270 94 L330 116 L400 98 L400 170 L0 170 Z" fill="url(#ridge-near)" />
      <path d={ROAD} fill="none" stroke="#F3F6F2" strokeOpacity=".28" strokeWidth="16" strokeLinecap="round" />
      <path className="scene-dashes" d={ROAD} fill="none" stroke="#F2B705" strokeWidth="2.5" strokeDasharray="9 11" />
      {[
        [62, 129],
        [150, 96],
        [300, 110],
      ].map(([x, y]) => (
        <g key={x} className="scene-stop">
          <circle cx={x} cy={y} r="11" fill="#F2B705" opacity=".25" />
          <circle cx={x} cy={y} r="5.5" fill="#F3F6F2" />
        </g>
      ))}
      <g className="scene-bus" transform={still ? "translate(150 96)" : undefined}>
        <g transform="translate(-14 -15)">
          <rect x="0" y="2" width="28" height="13" rx="3" fill="#F2B705" />
          <rect x="3" y="4.5" width="5" height="4" rx="1" fill="#143326" />
          <rect x="10" y="4.5" width="5" height="4" rx="1" fill="#143326" />
          <rect x="17" y="4.5" width="5" height="4" rx="1" fill="#143326" />
          <rect x="24" y="4.5" width="3" height="6" rx="1" fill="#143326" />
          <rect x="0" y="11" width="28" height="1.6" fill="#143326" opacity=".35" />
          <circle cx="7" cy="15.5" r="2.6" fill="#17231c" />
          <circle cx="21" cy="15.5" r="2.6" fill="#17231c" />
        </g>
        {!still && <animateMotion dur="11s" repeatCount="indefinite" rotate="auto" path={ROAD} />}
      </g>
    </svg>
  );
}
