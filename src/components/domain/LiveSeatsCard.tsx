import { Bus as BusIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { SeatCounter } from "@/components/domain/SeatCounter";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useRealtimeStore } from "@/store/realtime";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Live seat availability per bus, updated by WebSocket events. */
export function LiveSeatsCard({ highlightRouteId, initialCount = 5 }: { highlightRouteId?: string; initialCount?: number }) {
  const [all, setAll] = useState(false);
  const routes = useRoutes();
  const buses = useBuses();
  const seats = useRealtimeStore((s) => s.seats);
  const delta = useRealtimeStore((s) => s.seatDelta);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Seat availability</CardTitle>
          <CardDescription>Live: updates the moment a seat is booked or freed</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {routes.isError || buses.isError ? (
          <ErrorState onRetry={() => { routes.refetch(); buses.refetch(); }} />
        ) : routes.isLoading || buses.isLoading || !routes.data || !buses.data ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {[...buses.data]
              .sort((a, b) => (a.routeId === highlightRouteId ? -1 : b.routeId === highlightRouteId ? 1 : a.routeId.localeCompare(b.routeId)))
              .slice(0, all ? undefined : initialCount)
              .map((b) => {
              const route = routes.data!.find((r) => r.id === b.routeId);
              const s = seats[b.id];
              const d = delta[b.id];
              const used = s ? Math.round(((s.seatsTotal - s.seatsAvailable) / s.seatsTotal) * 100) : 0;
              return (
                <li key={b.id} className={cn("rounded-md border border-border p-4 transition-colors", highlightRouteId === b.routeId && "border-primary/50 bg-primary-soft/50")}>
                  <div className="flex items-center gap-3.5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-lg font-extrabold text-white" style={{ background: route?.color }}>
                      {route?.number ?? <BusIcon className="h-6 w-6" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold">{route?.name}{route?.note ? ` (${route.note})` : ""}</p>
                      <p className="text-sm text-muted-foreground">
                        {b.plate}
                        {highlightRouteId === b.routeId && <span className="ml-2 font-semibold text-primary">· Your route</span>}
                      </p>
                    </div>
                    {s ? <SeatCounter value={s.seatsAvailable} total={s.seatsTotal} className="text-3xl" /> : <Skeleton className="h-9 w-20" />}
                  </div>
                  {s && (
                    <div className="mt-3.5">
                      <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${used}%`, background: used > 85 ? "rgb(var(--danger))" : used > 65 ? "rgb(var(--warning))" : route?.color }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{used}% full</span>
                        {s.seatsAvailable === 0 ? (
                          <Badge tone={s.standingAvailable > 0 ? "warning" : "danger"}>{s.standingAvailable > 0 ? `Standing only · ${s.standingAvailable} left` : "Full"}</Badge>
                        ) : d !== undefined && d !== 0 ? (
                          <span className={cn("font-semibold", d > 0 ? "text-success" : "text-warning")}>{d > 0 ? `+${d} freed` : `${d} booked`} just now</span>
                        ) : (
                          <span className="text-muted-foreground">Seats available</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {buses.data.length > initialCount && (
              <li><Button variant="outline" className="w-full" onClick={() => setAll((v) => !v)}>{all ? "Show fewer routes" : `Show all ${buses.data.length} routes`}</Button></li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
