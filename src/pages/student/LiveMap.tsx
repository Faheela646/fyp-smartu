import { useMemo, useState } from "react";
import { Gauge, MapPin, Navigation, Phone, UserRound } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { RouteMap } from "@/components/domain/RouteMap";
import { SeatCounter } from "@/components/domain/SeatCounter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useDriversPublic, useMe } from "@/hooks/useOps";
import { useRealtimeStore } from "@/store/realtime";
import { useAuthStore } from "@/store/auth";
import { distanceKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

const fmtTime = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function LiveMap() {
  const user = useAuthStore((s) => s.user)!;
  const routes = useRoutes();
  const buses = useBuses();
  const drivers = useDriversPublic();
  const me = useMe();
  const positions = useRealtimeStore((s) => s.buses);
  const seats = useRealtimeStore((s) => s.seats);
  const tripActive = useRealtimeStore((s) => s.tripActive);
  const [focus, setFocus] = useState<string | undefined>(user.routeId);

  const ordered = useMemo(() => {
    if (!buses.data) return [];
    return [...buses.data].sort((a, b) => (a.routeId === user.routeId ? -1 : b.routeId === user.routeId ? 1 : a.routeId.localeCompare(b.routeId)));
  }, [buses.data, user.routeId]);
  const focusRoute = routes.data?.find((r) => r.id === focus);

  return (
    <div>
      <PageHeader title="Live bus map" description="All university routes, live. Pick a route to see its stops and timetable." />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="p-3 sm:p-4">
            <RouteMap focusRouteId={focus} className="h-[420px] lg:h-[520px]" />
          </Card>
          {focusRoute && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{focusRoute.name}{focusRoute.note ? ` (${focusRoute.note})` : ""}: timetable</CardTitle>
                  <CardDescription>{focusRoute.via}{focusRoute.contact ? ` · Authorised person: ${focusRoute.contact.name}, ${focusRoute.contact.phone}` : ""}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-x-8 sm:grid-cols-2">
                  {focusRoute.stops.map((s) => {
                    const mine = s.id === me.data?.stopId;
                    const campus = s.name === "Campus";
                    return (
                      <li key={s.id} className={cn("flex items-center justify-between gap-3 border-b border-border/70 py-2.5 text-[15px]", mine && "rounded-md bg-primary-soft/60 px-2 font-bold text-primary")}>
                        <span className="flex items-center gap-2"><MapPin className={cn("h-4 w-4 shrink-0", campus ? "text-accent" : "text-muted-foreground")} />{s.name}{mine && <Badge tone="primary">Your stop</Badge>}</span>
                        <span className="tabular-nums text-muted-foreground">{fmtTime(s.time)}</span>
                      </li>
                    );
                  })}
                </ol>
                {focusRoute.approxGeometry && <p className="mt-3 text-xs text-muted-foreground">Stop positions on the map are approximate; times are from the university timetable.</p>}
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Buses</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[78vh] overflow-y-auto">
            {!buses.data || !routes.data ? (
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
            ) : (
              <ul className="space-y-3">
                {ordered.map((b) => {
                  const r = routes.data!.find((x) => x.id === b.routeId)!;
                  const p = positions[b.id];
                  const s = seats[b.id];
                  const end = r.stops[r.stops.length - 1];
                  const km = p ? distanceKm([p.lat, p.lng], [end.lat, end.lng]) : null;
                  const eta = km !== null && p ? Math.max(1, Math.round((km / Math.max(22, p.speedKmh)) * 60)) : null;
                  const driver = drivers.data?.find((d) => d.busId === b.id);
                  const running = tripActive[b.id] !== false;
                  return (
                    <li key={b.id}>
                      <button onClick={() => setFocus(focus === r.id ? undefined : r.id)} aria-pressed={focus === r.id} className={cn("w-full rounded-md border p-4 text-left transition-colors", focus === r.id ? "border-primary bg-primary-soft/60" : "border-border hover:bg-muted")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-extrabold text-white" style={{ background: r.color }}>{r.number}</span>
                            <span className="min-w-0"><span className="block font-bold">{r.name}{r.note ? ` (${r.note})` : ""}</span><span className="block truncate text-xs text-muted-foreground">{r.via}</span></span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">{r.id === user.routeId && <Badge tone="primary">My route</Badge>}{!running && <Badge tone="neutral">Not running</Badge>}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">ETA</p>
                            <p className="flex items-center gap-1 font-extrabold tabular-nums">{eta ? <><Navigation className="h-4 w-4 text-primary" />{eta} min</> : "…"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Speed</p>
                            <p className="flex items-center gap-1 font-extrabold tabular-nums">{p ? <><Gauge className="h-4 w-4 text-primary" />{p.speedKmh} km/h</> : "…"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Seats</p>
                            {s ? <SeatCounter value={s.seatsAvailable} total={s.seatsTotal} className="text-lg" /> : <span>…</span>}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{b.plate}</p>
                        {driver && (
                          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted px-3 py-2 text-sm">
                            <span className="inline-flex items-center gap-1.5 font-semibold"><UserRound className="h-4 w-4 text-muted-foreground" />{driver.name}</span>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Phone className="h-4 w-4" />{driver.phone}</span>
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
