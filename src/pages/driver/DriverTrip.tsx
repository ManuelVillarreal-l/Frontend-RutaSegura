// Driver / monitor screen: start the trip, register who boards and who gets off,
// by QR code or by tapping the student, and finish the trip.

import { useMemo, useState, type FormEvent } from "react";
import { api, loadAllStops, loadHistories } from "../../api";
import { useCurrentUser } from "../../auth";
import { ErrorBox, Loading, Notice, PageHeader } from "../../components/Feedback";
import { RouteLine } from "../../components/RouteLine";
import { formatTime, TRIP_STATUS_LABEL } from "../../format";
import type { Stop, Student, Trip } from "../../types";
import { useLoad } from "../../useLoad";

type StudentState = "pending" | "on_board" | "delivered";

export function DriverTrip() {
  const user = useCurrentUser();
  const isDriver = user.role === "driver";

  const base = useLoad(async () => {
    const [trips, routes, students] = await Promise.all([api.trips(), api.routes(), api.students()]);
    const stopsByRoute = await loadAllStops(routes);
    return { trips, routes, students, stopsByRoute };
  }, []);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (base.loading && !base.data) return <Loading />;
  if (base.error || !base.data) return <ErrorBox message={base.error ?? "Error"} onRetry={base.reload} />;

  const { trips, routes } = base.data;
  const myTrips = trips
    .filter((trip) => trip.status !== "finished")
    .filter((trip) => (isDriver ? trip.driver_id === user.id : trip.status === "in_progress"))
    .sort((a, b) => (a.status === "in_progress" ? -1 : 0) - (b.status === "in_progress" ? -1 : 0));

  const selected = myTrips.find((trip) => trip.id === selectedId) ?? myTrips[0] ?? null;
  const routeName = (id: number) => routes.find((route) => route.id === id)?.name ?? `Ruta ${id}`;

  return (
    <>
      <PageHeader title={isDriver ? "Mi recorrido" : "Recorrido en curso"} />

      {myTrips.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Recorridos">
          {myTrips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              role="tab"
              aria-selected={trip.id === selected?.id}
              className="segmented-item"
              onClick={() => setSelectedId(trip.id)}
            >
              {routeName(trip.route_id)}
              <small>{TRIP_STATUS_LABEL[trip.status]}</small>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <TripPanel
          key={selected.id}
          trip={selected}
          routeName={routeName(selected.route_id)}
          stops={base.data.stopsByRoute[selected.route_id] ?? []}
          students={base.data.students.filter((s) => s.route_id === selected.route_id && s.active)}
          canManage={isDriver}
          onChanged={base.reload}
        />
      ) : isDriver ? (
        <ScheduleTrip routes={routes} driverId={user.id} onCreated={base.reload} />
      ) : (
        <Notice>No hay recorridos en curso en este momento.</Notice>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function ScheduleTrip({
  routes,
  driverId,
  onCreated,
}: {
  routes: { id: number; name: string }[];
  driverId: number;
  onCreated: () => void;
}) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.createTrip({ route_id: routeId, driver_id: driverId });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo programar el recorrido.");
    }
  }

  return (
    <section className="panel">
      <p>No tienes recorridos pendientes. Programa uno para empezar.</p>
      <form className="form form-inline" onSubmit={create}>
        <label className="field">
          <span>Ruta</span>
          <select value={routeId} onChange={(e) => setRouteId(Number(e.target.value))}>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button button-primary">
          Programar recorrido
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------

function TripPanel({
  trip,
  routeName,
  stops,
  students,
  canManage,
  onChanged,
}: {
  trip: Trip;
  routeName: string;
  stops: Stop[];
  students: Student[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const events = useLoad(async () => {
    const histories = await loadHistories(students.map((s) => s.id));
    return Object.values(histories)
      .flat()
      .filter((event) => event.trip_id === trip.id);
  }, [trip.id, students.map((s) => s.id).join(",")]);

  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  const schoolStop = stops[stops.length - 1] ?? null;
  const tripEvents = events.data ?? [];

  const stateOf = useMemo(() => {
    const states = new Map<number, StudentState>();
    const sorted = [...tripEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of sorted) {
      states.set(event.student_id, event.event_type === "boarding" ? "on_board" : "delivered");
    }
    return (studentId: number): StudentState => states.get(studentId) ?? "pending";
  }, [tripEvents]);

  const busStopId = useMemo(() => {
    if (trip.status === "scheduled") return null;
    const latest = [...tripEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    return latest?.stop_id ?? stops[0]?.id ?? null;
  }, [tripEvents, trip.status, stops]);

  const counts = {
    pending: students.filter((s) => stateOf(s.id) === "pending").length,
    onBoard: students.filter((s) => stateOf(s.id) === "on_board").length,
    delivered: students.filter((s) => stateOf(s.id) === "delivered").length,
  };

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "success", text: success });
      await events.reload();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "No se pudo registrar." });
    } finally {
      setBusy(false);
    }
  }

  function register(student: Student, eventType: "boarding" | "drop_off") {
    const stopId = eventType === "boarding" ? student.stop_id : schoolStop?.id ?? null;
    void act(
      () =>
        api.registerEvent({
          student_id: student.id,
          trip_id: trip.id,
          stop_id: stopId,
          event_type: eventType,
          method: "manual",
        }),
      `${student.full_name}: ${eventType === "boarding" ? "subió al bus" : "bajó del bus"}.`,
    );
  }

  async function startTrip() {
    setBusy(true);
    setMessage(null);
    try {
      await api.startTrip(trip.id);
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "No se pudo iniciar." });
    } finally {
      setBusy(false);
    }
  }

  async function finishTrip() {
    setBusy(true);
    setMessage(null);
    try {
      await api.finishTrip(trip.id);
      await onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "No se pudo finalizar." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="trip">
      <div className="trip-head">
        <div>
          <h2>{routeName}</h2>
          <p className="muted">
            Recorrido #{trip.id}
            {trip.started_at ? `, iniciado a las ${formatTime(trip.started_at)}` : ""}
          </p>
        </div>
        <span className={`status status-${trip.status}`}>{TRIP_STATUS_LABEL[trip.status]}</span>
      </div>

      {trip.status === "scheduled" &&
        (canManage ? (
          <button type="button" className="button button-primary button-big" disabled={busy} onClick={startTrip}>
            Iniciar recorrido
          </button>
        ) : (
          <Notice>El conductor todavía no ha iniciado este recorrido.</Notice>
        ))}

      {trip.status === "in_progress" && (
        <>
          <QrForm
            disabled={busy}
            onScan={(code) => {
              const student = students.find((s) => s.qr_code.toLowerCase() === code.toLowerCase());
              if (!student) {
                setMessage({ kind: "error", text: `El código ${code} no es de un estudiante de esta ruta.` });
                return;
              }
              const state = stateOf(student.id);
              if (state === "delivered") {
                setMessage({ kind: "error", text: `${student.full_name} ya bajó del bus en este recorrido.` });
                return;
              }
              const eventType = state === "pending" ? "boarding" : "drop_off";
              void act(
                () =>
                  api.scanQr({
                    qr_code: student.qr_code,
                    trip_id: trip.id,
                    stop_id: eventType === "boarding" ? student.stop_id : schoolStop?.id ?? null,
                    event_type: eventType,
                  }),
                `${student.full_name}: ${eventType === "boarding" ? "subió al bus" : "bajó del bus"}.`,
              );
            }}
          />
          <p className="trip-counts">
            <span><strong>{counts.pending}</strong> por recoger</span>
            <span><strong>{counts.onBoard}</strong> a bordo</span>
            <span><strong>{counts.delivered}</strong> entregados</span>
          </p>
        </>
      )}

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {events.error && <ErrorBox message={events.error} onRetry={events.reload} />}

      <RouteLine
        stops={stops}
        busStopId={busStopId}
        renderStop={(stop) => {
          const isSchool = stop.id === schoolStop?.id;
          const here = isSchool
            ? students.filter((s) => stateOf(s.id) !== "pending" || s.stop_id === stop.id)
            : students.filter((s) => s.stop_id === stop.id);
          if (here.length === 0) return null;
          return (
            <ul className="stop-students">
              {here.map((student) => {
                const state = stateOf(student.id);
                const showBoard = trip.status === "in_progress" && !isSchool && state === "pending";
                const showDrop = trip.status === "in_progress" && isSchool && state === "on_board";
                return (
                  <li key={student.id} className={`stop-student is-${state}`}>
                    <span>
                      {student.full_name}
                      <small>{STATE_LABEL[state]}</small>
                    </span>
                    {showBoard && (
                      <button type="button" className="button button-primary" disabled={busy} onClick={() => register(student, "boarding")}>
                        Subió
                      </button>
                    )}
                    {showDrop && (
                      <button type="button" className="button button-primary" disabled={busy} onClick={() => register(student, "drop_off")}>
                        Bajó
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }}
      />

      {trip.status === "in_progress" && canManage && (
        <div className="trip-finish">
          {confirmFinish && counts.onBoard > 0 ? (
            <Notice kind="error">
              <p>
                Todavía hay {counts.onBoard} {counts.onBoard === 1 ? "estudiante" : "estudiantes"} a bordo. ¿Finalizar
                de todos modos?
              </p>
              <div className="button-row">
                <button type="button" className="button button-danger" disabled={busy} onClick={finishTrip}>
                  Sí, finalizar
                </button>
                <button type="button" className="button button-quiet" onClick={() => setConfirmFinish(false)}>
                  Volver
                </button>
              </div>
            </Notice>
          ) : (
            <button
              type="button"
              className="button button-secondary button-big"
              disabled={busy}
              onClick={() => (counts.onBoard > 0 ? setConfirmFinish(true) : void finishTrip())}
            >
              Finalizar recorrido
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const STATE_LABEL: Record<StudentState, string> = {
  pending: "Por recoger",
  on_board: "A bordo",
  delivered: "Entregado",
};

function QrForm({ onScan, disabled }: { onScan: (code: string) => void; disabled: boolean }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="qr-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!code.trim()) return;
        onScan(code.trim());
        setCode("");
      }}
    >
      <label className="field">
        <span>Código QR del estudiante</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ej.: RS-DEMO-0001"
          autoCapitalize="characters"
          autoComplete="off"
        />
      </label>
      <button type="submit" className="button button-primary" disabled={disabled}>
        Registrar
      </button>
    </form>
  );
}

