// App shell: top bar with brand, navigation for the user's role and logout.

import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { onSlowServer } from "../api";
import { useCurrentUser, useSession } from "../auth";
import { ROLE_LABEL } from "../format";
import type { Role } from "../types";

const NAV: Record<Role, { to: string; label: string }[]> = {
  coordinator: [
    { to: "/", label: "Resumen" },
    { to: "/estudiantes", label: "Estudiantes" },
    { to: "/rutas", label: "Rutas" },
    { to: "/recorridos", label: "Recorridos" },
    { to: "/usuarios", label: "Usuarios" },
    { to: "/retrasos", label: "Predicción de retrasos" },
  ],
  driver: [
    { to: "/", label: "Mi recorrido" },
    { to: "/retrasos", label: "Predicción de retrasos" },
  ],
  monitor: [{ to: "/", label: "Recorrido en curso" }],
  guardian: [{ to: "/", label: "Mis hijos" }],
};

export function Layout() {
  const user = useCurrentUser();
  const { logout } = useSession();
  const slow = useSlowServer();
  const links = NAV[user.role];

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-user">
            <span className="topbar-name">
              {user.name}
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
            <button type="button" className="button button-on-dark" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </div>
        {links.length > 1 && (
          <nav className="nav" aria-label="Secciones">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end className="nav-link">
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
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



