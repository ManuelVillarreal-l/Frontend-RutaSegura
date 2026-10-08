// The signature element of RutaSegura: a route drawn as a road,
// with its stops in order and the bus where it currently is.

import type { ReactNode } from "react";
import type { Stop } from "../types";

interface Props {
  stops: Stop[];
  // Stop id where the bus is (or was last seen). null hides the bus.
  busStopId?: number | null;
  // Stop id to highlight (for example, a child's pickup stop).
  highlightStopId?: number | null;
  // Extra content under each stop (students, buttons...).
  renderStop?: (stop: Stop) => ReactNode;
}

export function RouteLine({ stops, busStopId = null, highlightStopId = null, renderStop }: Props) {
  if (stops.length === 0) {
    return <p className="muted">Esta ruta todavía no tiene paradas.</p>;
  }
  const lastId = stops[stops.length - 1].id;
  const busIndex = busStopId === null ? -1 : stops.findIndex((stop) => stop.id === busStopId);

  return (
    <ol className="route-line">
      {stops.map((stop, index) => {
        const classes = ["route-stop"];
        if (index <= busIndex) classes.push("is-passed");
        if (stop.id === highlightStopId) classes.push("is-highlight");
        if (stop.id === lastId) classes.push("is-school");
        return (
          <li key={stop.id} className={classes.join(" ")}>
            <span className="route-dot" aria-hidden="true">
              {stop.id === busStopId && <BusIcon />}
            </span>
            <div className="route-stop-body">
              <p className="route-stop-name">
                {stop.name}
                {stop.id === busStopId && <span className="sr-only"> (el bus está aquí)</span>}
              </p>
              {renderStop?.(stop)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function BusIcon() {
  return (
    <svg className="bus-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="6" width="24" height="18" rx="5" fill="#F2B705" stroke="#17231C" strokeWidth="2" />
      <rect x="8" y="10" width="16" height="6" rx="1.5" fill="#17231C" />
      <circle cx="10" cy="25" r="3" fill="#17231C" />
      <circle cx="22" cy="25" r="3" fill="#17231C" />
    </svg>
  );
}
