// Map with OpenStreetMap tiles (Leaflet): stops, the bus position and its GPS trail.

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  highlight?: boolean;
  isSchool?: boolean;
}

export interface MapBus {
  id: number | string;
  latitude: number;
  longitude: number;
  label: string;
}

interface Props {
  stops?: MapStop[];
  buses?: MapBus[];
  trail?: [number, number][];
  // Draws the line that joins the stops in order.
  connectStops?: boolean;
  height?: number;
  onMapClick?: (latitude: number, longitude: number) => void;
  label?: string;
}

const DEFAULT_CENTER: [number, number] = [1.15, -77.16]; // El Encano, Nariño

const busIcon = L.divIcon({
  className: "map-bus",
  html: `<svg viewBox="0 0 32 32" width="34" height="34"><rect x="4" y="6" width="24" height="18" rx="5" fill="#F2B705" stroke="#17231C" stroke-width="2"/><rect x="8" y="10" width="16" height="6" rx="1.5" fill="#17231C"/><circle cx="10" cy="25" r="3" fill="#17231C"/><circle cx="22" cy="25" r="3" fill="#17231C"/></svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 20],
});

function stopIcon(stop: MapStop, index: number) {
  const kind = stop.isSchool ? "school" : stop.highlight ? "highlight" : "stop";
  return L.divIcon({
    className: `map-stop map-stop-${kind}`,
    html: `<span>${stop.isSchool ? "🏫" : index + 1}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MapView({ stops = [], buses = [], trail = [], connectStops = true, height = 320, onMapClick, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const clickHandler = useRef(onMapClick);
  clickHandler.current = onMapClick;

  // Create the map once.
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false }).setView(DEFAULT_CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    instance.on("click", (e: L.LeafletMouseEvent) => clickHandler.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  // Redraw markers when data changes.
  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    const points: L.LatLngExpression[] = [];

    if (connectStops && stops.length > 1) {
      L.polyline(
        stops.map((s) => [s.latitude, s.longitude] as [number, number]),
        { color: "#1E4A37", weight: 5, opacity: 0.55, dashArray: "8 8" },
      ).addTo(group);
    }
    stops.forEach((stop, index) => {
      L.marker([stop.latitude, stop.longitude], { icon: stopIcon(stop, index), title: stop.name })
        .bindTooltip(stop.name)
        .addTo(group);
      points.push([stop.latitude, stop.longitude]);
    });
    if (trail.length > 1) {
      L.polyline(trail, { color: "#F2B705", weight: 6, opacity: 0.9 }).addTo(group);
    }
    buses.forEach((bus) => {
      L.marker([bus.latitude, bus.longitude], { icon: busIcon, zIndexOffset: 1000, title: bus.label })
        .bindTooltip(bus.label, { permanent: false })
        .addTo(group);
      points.push([bus.latitude, bus.longitude]);
    });

    // Fit the view the first time there is something to show.
    if (!fitted.current && points.length > 0) {
      instance.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15, animate: false });
      fitted.current = true;
    }
  }, [stops, buses, trail, connectStops]);

  return (
    <div
      ref={container}
      className="map"
      style={{ height }}
      role="img"
      aria-label={label ?? "Mapa del recorrido con las paradas y la ubicación del bus"}
    />
  );
}
