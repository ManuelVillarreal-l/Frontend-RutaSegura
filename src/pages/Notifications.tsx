// Notifications for every role (bus started, child boarded, bus approaching, incidents).

import { api } from "../api";
import { ErrorBox, Loading, PageHeader } from "../components/Feedback";
import { formatDateTime } from "../format";
import { useInterval, useLoad } from "../hooks";

const ICON: Record<string, string> = {
  boarding: "🚌",
  drop_off: "✅",
  trip_started: "🛣️",
  incident: "⚠️",
};

export function Notifications() {
  const data = useLoad(() => api.notifications(), []);
  useInterval(() => void data.reload(true), 20_000);

  async function readAll() {
    await api.readAllNotifications().catch(() => undefined);
    window.dispatchEvent(new Event("rutasegura:notifications-read"));
    await data.reload(true);
  }

  const unread = (data.data ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader title="Avisos">
        {unread > 0 && (
          <button type="button" className="button button-quiet" onClick={() => void readAll()}>
            Marcar todo como leído
          </button>
        )}
      </PageHeader>
      {data.loading && !data.data ? (
        <Loading />
      ) : data.error || !data.data ? (
        <ErrorBox message={data.error ?? "Error"} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <p className="muted">No tiene avisos.</p>
      ) : (
        <ul className="notifications">
          {data.data.map((n) => (
            <li key={n.id} className={`notification${n.read_at ? "" : " is-unread"}`}>
              <span className="notification-icon" aria-hidden="true">
                {n.kind.startsWith("near:") ? "📍" : ICON[n.kind] ?? "🔔"}
              </span>
              <span>
                <strong>{n.title}</strong>
                <span>{n.message}</span>
                <small className="muted">{formatDateTime(n.created_at)}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
