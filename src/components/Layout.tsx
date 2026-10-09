// App shell: brand, navigation for the user's role, session countdown, notifications and logout.

import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, onSlowServer } from "../api";
import { useCurrentUser, useSession } from "../auth";
import type { RoleCode } from "../types";

const NAV: Record<RoleCode, { to: string; label: string }[]> = {
  coordinator: [
    { to: "/", label: "Resumen" },
    { to: "/estudiantes", label: "Estudiantes" },
    { to: "/rutas", label: "Rutas" },
    { to: "/recorridos", label: "Recorridos" },
    { to: "/usuarios", label: "Usuarios" },
    { to: "/flota", label: "Flota" },
    { to: "/catalogos", label: "Catálogos" },
    { to: "/inteligencia", label: "Inteligencia" },
    { to: "/incidentes", label: "Incidentes" },
    { to: "/estructuras", label: "Estructuras" },
    { to: "/auditoria", label: "Auditoría" },
  ],
  driver: [
    { to: "/", label: "Mi recorrido" },
    { to: "/inteligencia", label: "Predicción de retrasos" },
  ],
  monitor: [
    { to: "/", label: "Recorrido en curso" },
    { to: "/inteligencia", label: "Predicción de retrasos" },
  ],
  guardian: [{ to: "/", label: "Mis hijos" }],
};

const POLL_MS = 30_000;

export function Layout() {
  const user = useCurrentUser();
  const { logout } = useSession();
  const slow = useSlowServer();
  const unread = useUnreadCount();
  const links = [...NAV[user.role.code], { to: "/notificaciones", label: "Avisos" }];

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-user">
            <SessionTimer />
            <NavLink to="/notificaciones" className="bell" aria-label={`Avisos: ${unread} sin leer`}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
            </NavLink>
            <span className="topbar-name">
              {user.first_name} {user.last_name}
              <small>{user.role.name}</small>
            </span>
            <button type="button" className="button button-on-dark" onClick={() => logout()}>
              Salir
            </button>
          </div>
        </div>
        <nav className="nav" aria-label="Secciones">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {slow && (
        <p className="server-waking" role="status">
          Conectando con el servidor. Si estaba en reposo puede tardar hasta un minuto.
        </p>
      )}

      <main id="main" className="main">
        <Outlet />
      </main>
    </div>
  );
}

// Shows how much time is left before the 30-minute token expires.
function SessionTimer() {
  const { expiresAt } = useSession();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!expiresAt) return null;
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const minutes = Math.floor(left / 60);
  const seconds = String(left % 60).padStart(2, "0");
  const warning = left <= 120;
  return (
    <span
      className={`session-timer${warning ? " is-warning" : ""}`}
      title="La sesión se cierra sola a los 30 minutos por seguridad"
      role={warning ? "alert" : undefined}
    >
      <span className="sr-only">La sesión se cierra en </span>
      {minutes}:{seconds}
    </span>
  );
}

function useUnreadCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .notifications(true)
        .then((items) => active && setCount(items.length))
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, POLL_MS);
    const onRead = () => setCount(0);
    window.addEventListener("rutasegura:notifications-read", onRead);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("rutasegura:notifications-read", onRead);
    };
  }, []);
  return count;
}

export function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 64 64" className="brand-mark" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#F2B705" />
        <rect x="16" y="20" width="32" height="24" rx="6" fill="#1E4A37" />
        <rect x="21" y="25" width="22" height="8" rx="2" fill="#F3F6F2" />
        <circle cx="23" cy="46" r="4" fill="#17231C" />
        <circle cx="41" cy="46" r="4" fill="#17231C" />
      </svg>
      RutaSegura
    </span>
  );
}

export function useSlowServer(): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowServer(setSlow), []);
  return slow;
}
