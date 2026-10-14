import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Polyline, CircleMarker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useRealtimeStore } from "@/store/realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { Bus, TransportRoute } from "@/types/api";

const GLIDE_MS = 2000; // matches the GPS tick, so motion is continuous

function busIcon(color: string, label: string) {
  return L.divIcon({
    className: "bus-marker",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="position:relative;width:38px;height:38px" title="Route ${label}">
      <div class="bus-arrow" data-arrow style="transition:transform .4s linear"><svg viewBox="0 0 38 38" width="38" height="38"><path d="M19 -4 L25 6 L13 6 Z" fill="${color}"/></svg></div>
      <div class="bus-dot" style="background:${color}">${label}</div></div>`,
  });
}

/** Moves each bus marker smoothly toward its newest GPS fix (interpolated with rAF). */
function BusLayer({ buses, routes, follow }: { buses: Bus[]; routes: TransportRoute[]; follow?: string }) {
  const map = useMap();
  const markers = useRef(new Map<string, { m: L.Marker; from: [number, number]; to: [number, number]; t0: number }>());
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    const color = (b: Bus) => routes.find((r) => r.id === b.routeId)?.color ?? "#1D4ED8";
    const placeFrom = (id: string) => useRealtimeStore.getState().buses[id];

    const ensure = (b: Bus) => {
      const p = placeFrom(b.id);
      if (!p) return;
      const existing = markers.current.get(b.id);
      if (!existing) {
        const m = L.marker([p.lat, p.lng], { icon: busIcon(color(b), b.routeId.slice(1)), zIndexOffset: 1000, keyboard: false }).addTo(map);
        m.bindTooltip(`Route ${b.routeId.slice(1)} · ${b.plate}`, { direction: "top", offset: [0, -22] });
        markers.current.set(b.id, { m, from: [p.lat, p.lng], to: [p.lat, p.lng], t0: performance.now() });
      } else {
        const cur = existing.m.getLatLng();
        existing.from = [cur.lat, cur.lng];
        existing.to = [p.lat, p.lng];
        existing.t0 = performance.now();
        const arrow = existing.m.getElement()?.querySelector<HTMLElement>("[data-arrow]");
        if (arrow) arrow.style.transform = `rotate(${p.heading}deg)`;
      }
    };

    buses.forEach(ensure);
    const unsub = useRealtimeStore.subscribe((s, prev) => {
      buses.forEach((b) => {
        if (s.buses[b.id] !== prev.buses[b.id]) ensure(b);
      });
    });

    let raf = 0;
    const tick = (now: number) => {
      markers.current.forEach((v, id) => {
        const k = Math.min(1, (now - v.t0) / GLIDE_MS);
        const lat = v.from[0] + (v.to[0] - v.from[0]) * k;
        const lng = v.from[1] + (v.to[1] - v.from[1]) * k;
        v.m.setLatLng([lat, lng]);
        if (followRef.current === id && k < 1 && Math.random() < 0.05) map.panTo([lat, lng], { animate: true, duration: 0.5 });
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      unsub();
      cancelAnimationFrame(raf);
      markers.current.forEach((v) => v.m.remove());
      markers.current.clear();
    };
  }, [map, buses, routes]);

  return null;
}

function FitRoutes({ routes, focus }: { routes: TransportRoute[]; focus?: string }) {
  const map = useMap();
  useEffect(() => {
    const target = focus ? routes.filter((r) => r.id === focus) : routes;
    const pts = target.flatMap((r) => r.path);
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 14 });
  }, [map, routes, focus]);
  return null;
}

export function RouteMap({ focusRouteId, className, interactive = true }: { focusRouteId?: string; className?: string; interactive?: boolean }) {
  const routes = useRoutes();
  const buses = useBuses();
  const busList = useMemo(() => buses.data ?? [], [buses.data]);
  const routeList = useMemo(() => routes.data ?? [], [routes.data]);

  if (routes.isError || buses.isError) return <ErrorState message="The map couldn't load." onRetry={() => { routes.refetch(); buses.refetch(); }} />;
  if (!routes.data || !buses.data) return <Skeleton className={cn("h-[380px] w-full", className)} />;

  return (
    <div className={cn("relative z-0 h-[380px] overflow-hidden rounded-lg border border-border", className)} role="region" aria-label="Live shuttle map">
      <MapContainer center={[31.5, 73.0]} zoom={10} scrollWheelZoom={interactive} dragging={interactive} zoomControl={interactive} className="h-full w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {routeList.map((r) => {
          const dim = !!focusRouteId && focusRouteId !== r.id;
          return <Polyline key={r.id} positions={r.path} pathOptions={{ color: r.color, weight: dim ? 2 : focusRouteId ? 6 : 3.5, opacity: dim ? 0.25 : 0.85, lineCap: "round" }} />;
        })}
        {/* Stops are drawn only for the focused route: 170 markers at once would slow the map down. */}
        {routeList
          .filter((r) => r.id === focusRouteId)
          .flatMap((r) =>
            r.stops.map((s) => (
              <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={6} pathOptions={{ color: r.color, fillColor: "#fff", fillOpacity: 1, weight: 3 }}>
                <Tooltip direction="top">{s.name}{s.time ? ` · ${s.time}` : ""}</Tooltip>
              </CircleMarker>
            )),
          )}
        <BusLayer buses={busList} routes={routeList} />
        <FitRoutes routes={routeList} focus={focusRouteId} />
      </MapContainer>
    </div>
  );
}
