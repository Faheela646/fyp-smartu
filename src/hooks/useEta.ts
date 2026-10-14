import { useMemo } from "react";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useRealtimeStore } from "@/store/realtime";
import { distanceKm } from "@/lib/geo";

/** Live ETA (minutes) of the bus on `routeId` to the route's final stop (campus). Recomputed on every GPS update. */
export function useEta(routeId?: string) {
  const routes = useRoutes();
  const buses = useBuses();
  const bus = buses.data?.find((b) => b.routeId === routeId);
  const pos = useRealtimeStore((s) => (bus ? s.buses[bus.id] : undefined)); // only re-render for THIS bus

  return useMemo(() => {
    const route = routes.data?.find((r) => r.id === routeId);
    if (!route || !bus || !pos) return null;
    const stop = route.stops[route.stops.length - 1];
    const km = distanceKm([pos.lat, pos.lng], [stop.lat, stop.lng]);
    const speed = Math.max(22, pos.speedKmh);
    return { minutes: Math.max(1, Math.round((km / speed) * 60)), km, bus, route, stopName: stop.name };
  }, [routes.data, bus, pos, routeId]);
}
