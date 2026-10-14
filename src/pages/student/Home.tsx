import { Link } from "react-router-dom";
import { Armchair, ArrowRight, Bus, QrCode, Ticket, Wallet } from "lucide-react";
import { Hero } from "@/components/domain/Hero";
import { StatCard } from "@/components/domain/StatCard";
import { LiveSeatsCard } from "@/components/domain/LiveSeatsCard";
import { RecentNotifications } from "@/components/domain/RecentNotifications";
import { RouteMap } from "@/components/domain/RouteMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth";
import { useRealtimeStore } from "@/store/realtime";
import { useEta } from "@/hooks/useEta";
import { useBills, useFees } from "@/hooks/useOps";

export default function StudentHome() {
  const user = useAuthStore((s) => s.user)!;
  const live = useRealtimeStore((s) => Object.keys(s.buses).length); // a number: no re-render on every GPS tick
  const eta = useEta(user.routeId);
  const mySeats = useRealtimeStore((s) => (eta ? s.seats[eta.bus.id] : undefined));
  const isHostelite = user.role === "HOSTELITE";
  const fees = useFees(user.id, !isHostelite);
  const bills = useBills(user.id, isHostelite);

  const dues = isHostelite ? (bills.data ?? []).filter((b) => b.status === "UNPAID").reduce((a, b) => a + b.amount, 0) : (fees.data ?? []).filter((f) => f.status === "UNPAID" || f.status === "REJECTED").reduce((a, f) => a + f.amount, 0);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6 sm:space-y-8">
      <Hero>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/80">{today}</p>
            <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">Hi, {user.name.split(" ")[0]}</h2>
            <div className="mt-5">
              {eta ? (
                <>
                  <p className="text-base text-white/85">Your bus on <span className="font-semibold text-white">{eta.route.name}</span> reaches {eta.stopName} in</p>
                  <p className="mt-1 flex items-baseline gap-2 text-5xl font-extrabold tabular-nums sm:text-6xl">
                    {eta.minutes}
                    <span className="text-xl font-semibold text-white/85">min</span>
                    <span className="ml-2 text-base font-medium text-white/75">{eta.km.toFixed(1)} km away</span>
                  </p>
                </>
              ) : (
                <>
                  <Skeleton className="h-5 w-72 bg-white/20" />
                  <Skeleton className="mt-3 h-14 w-40 bg-white/20" />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-[#14307A] hover:bg-white/90">
              <Link to="/student/qr">
                <QrCode className="h-5 w-5" /> Show my QR
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
              <Link to="/student/book">
                <Ticket className="h-5 w-5" /> Book a ticket
              </Link>
            </Button>
          </div>
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Buses live now" value={live} icon={Bus} tone="primary" loading={live === 0} hint="Moving on campus routes" />
        <StatCard label="Seats on my route" value={mySeats?.seatsAvailable ?? 0} icon={Armchair} tone="success" loading={!mySeats} hint={eta ? `${eta.bus.plate} · of ${mySeats?.seatsTotal ?? "–"}` : undefined} />
        <StatCard label="Standing spots" value={mySeats?.standingAvailable ?? 0} icon={Ticket} tone="accent" loading={!mySeats} hint="Half-price ticket" />
        <StatCard label={isHostelite ? "Unpaid monthly bills" : "Semester fee due"} value={dues} prefix="Rs. " icon={Wallet} tone={dues ? "warning" : "success"} loading={isHostelite ? bills.isLoading : fees.isLoading} hint={dues ? "See Fees" : "You're all clear"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live map</CardTitle>
              <CardDescription>Buses glide in real time. Your route is highlighted</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/student/map">
                Full map <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RouteMap focusRouteId={user.routeId} className="h-[420px]" />
          </CardContent>
        </Card>
        <LiveSeatsCard highlightRouteId={user.routeId} />
      </div>

      <RecentNotifications />
    </div>
  );
}
