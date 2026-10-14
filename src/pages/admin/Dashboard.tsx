import { Activity, Bus, Receipt, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Hero } from "@/components/domain/Hero";
import { StatCard } from "@/components/domain/StatCard";
import { LiveSeatsCard } from "@/components/domain/LiveSeatsCard";
import { RecentNotifications } from "@/components/domain/RecentNotifications";
import { RouteMap } from "@/components/domain/RouteMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeStore } from "@/store/realtime";
import { useBuses } from "@/hooks/useTransportData";

const peak = [
  { h: "6am", riders: 40 }, { h: "7am", riders: 210 }, { h: "8am", riders: 520 }, { h: "9am", riders: 330 },
  { h: "12pm", riders: 180 }, { h: "2pm", riders: 410 }, { h: "4pm", riders: 560 }, { h: "5pm", riders: 380 }, { h: "7pm", riders: 90 },
];

export default function AdminDashboard() {
  const buses = useBuses();
  const seats = useRealtimeStore((s) => s.seats);
  const list = buses.data ?? [];
  const states = list.map((b) => seats[b.id]).filter(Boolean);
  const total = states.reduce((a, s) => a + s.seatsTotal, 0);
  const free = states.reduce((a, s) => a + s.seatsAvailable, 0);
  const occupancy = total ? Math.round(((total - free) / total) * 100) : 0;
  const ready = states.length === list.length && list.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <Hero>
        <p className="text-base font-semibold text-white/85">Transport Office</p>
        <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl lg:text-5xl">Operations overview</h2>
        <p className="mt-2 max-w-3xl text-base sm:text-lg text-white/90">Fleet occupancy, rider volume and revenue at a glance. Everything below updates live.</p>
      </Hero>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Fleet occupancy" value={occupancy} suffix="%" icon={Activity} tone="primary" loading={!ready} hint="Across all running buses" />
        <StatCard label="Active buses" value={list.length} icon={Bus} tone="accent" loading={buses.isLoading} hint="Reporting GPS" />
        <StatCard label="Riders today" value={1842} icon={Users} tone="success" hint="Scans since 6am (sample)" />
        <StatCard label="Revenue, this month" value={684500} prefix="Rs. " icon={Receipt} tone="warning" hint="Sample data" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Fleet map</CardTitle>
              <CardDescription>Every route and bus, live</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RouteMap className="h-[480px]" />
          </CardContent>
        </Card>
        <LiveSeatsCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Peak hours</CardTitle>
              <CardDescription>Boardings by time of day (sample data)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80" role="img" aria-label="Area chart of boardings by hour, peaking around 8am and 4pm">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={peak} margin={{ left: -16, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="peak" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                  <XAxis dataKey="h" tickLine={false} axisLine={false} tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 14 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 14 }} />
                  <Tooltip contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, color: "rgb(var(--foreground))", fontSize: 14 }} />
                  <Area type="monotone" dataKey="riders" stroke="rgb(var(--primary))" strokeWidth={3} fill="url(#peak)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <RecentNotifications />
      </div>
    </div>
  );
}
