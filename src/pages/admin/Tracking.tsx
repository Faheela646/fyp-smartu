import { PageHeader } from "@/components/domain/PageHeader";
import { RouteMap } from "@/components/domain/RouteMap";
import { SeatCounter } from "@/components/domain/SeatCounter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useRealtimeStore } from "@/store/realtime";
import { timeAgo } from "@/lib/utils";

export default function Tracking() {
  const routes = useRoutes();
  const buses = useBuses();
  const pos = useRealtimeStore((s) => s.buses);
  const seats = useRealtimeStore((s) => s.seats);
  const tripActive = useRealtimeStore((s) => s.tripActive);
  return (
    <div>
      <PageHeader title="Live tracking" description="Real-time GPS position, speed and load of every bus." />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_460px]">
        <Card className="p-3 sm:p-5"><RouteMap className="h-[500px] xl:h-[680px]" /></Card>
        <Card className="h-fit">
          <CardHeader><CardTitle>Fleet status</CardTitle></CardHeader>
          <CardContent>
            {!buses.data || !routes.data ? <Skeleton className="h-64 w-full" /> : (
              <ul className="divide-y divide-border">
                {buses.data.map((b) => {
                  const r = routes.data!.find((x) => x.id === b.routeId);
                  const p = pos[b.id];
                  const s = seats[b.id];
                  return (
                    <li key={b.id} className="py-4 first:pt-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full" style={{ background: r?.color }} /><div><p className="text-base font-bold sm:text-lg">{b.plate}</p><p className="text-sm sm:text-base text-muted-foreground">{r?.name}</p></div></div>
                        {tripActive[b.id] === false ? <Badge tone="neutral">Not running</Badge> : p ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Waiting</Badge>}
                      </div>
                      <div className="mt-3.5 grid grid-cols-3 gap-2.5 text-base">
                        <div><p className="text-xs sm:text-sm font-semibold text-muted-foreground">Speed</p><p className="text-base font-bold tabular-nums">{p ? `${p.speedKmh} km/h` : "…"}</p></div>
                        <div><p className="text-xs sm:text-sm font-semibold text-muted-foreground">Updated</p><p className="text-base font-bold">{p ? timeAgo(p.ts) : "…"}</p></div>
                        <div><p className="text-xs sm:text-sm font-semibold text-muted-foreground">Seats free</p>{s ? <SeatCounter value={s.seatsAvailable} total={s.seatsTotal} className="text-xl" /> : "…"}</div>
                      </div>
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
