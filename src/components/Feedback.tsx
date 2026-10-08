// Small status components: loading, error and inline notices.

import type { ReactNode } from "react";

export function Loading({ text = "Cargando…" }: { text?: string }) {
  return (
    <p className="loading" role="status">
      {text}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button button-quiet" onClick={onRetry}>
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "success" | "error"; children: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {children && <div className="page-header-extra">{children}</div>}
    </header>
  );
}



