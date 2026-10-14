import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFines, useScanLogs } from "@/hooks/useOps";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { exportCSV, exportPDF, type Row } from "@/lib/export";

const axis = { fill: "rgb(var(--muted-foreground))", fontSize: 15 };
const tip = { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, color: "rgb(var(--foreground))", fontSize: 15 };

/** Deterministic sample trend so the demo charts look realistic. */
const trend = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * 86400000);
  const weekend = [0, 6].includes(d.getDay());
  return { day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), riders: weekend ? 120 + i * 3 : 520 + ((i * 37) % 160), attendance: weekend ? 70 : 86 + (i % 5) };
});
const peak = [["6am", 40], ["7am", 210], ["8am", 520], ["9am", 330], ["12pm", 180], ["2pm", 410], ["4pm", 560], ["5pm", 380], ["7pm", 90]].map(([h, riders]) => ({ h, riders }));
const PIE = ["rgb(var(--primary))", "rgb(var(--accent))", "rgb(var(--warning))", "rgb(var(--danger))"];

export default function Reports() {
  const buses = useBuses();
  const routes = useRoutes();
  const logs = useScanLogs();
  const fines = useFines();
  const [route, setRoute] = useState("all");
  const [from, setFrom] = useState(new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const usage = useMemo(() => {
    if (!routes.data || !buses.data) return [];
    return routes.data.filter((r) => route === "all" || r.id === route).map((r) => {
      const ids = buses.data!.filter((b) => b.routeId === r.id).map((b) => b.id);
      const scans = (logs.data ?? []).filter((l) => ids.includes(l.busId) && l.result !== "FAILED").length;
      return { name: r.name.replace(" Route", ""), riders: 180 + scans * 14 + r.stops.length * 22, color: r.color };
    });
  }, [routes.data, buses.data, logs.data, route]);

  const finesMix = useMemo(() => {
    const m: Record<string, number> = {};
    (fines.data ?? []).forEach((f) => (m[f.reason] = (m[f.reason] ?? 0) + f.amount));
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [fines.data]);

  const rows = (): Row[] => trend.map((t) => ({ Date: t.day, Riders: t.riders, "Attendance %": t.attendance, Route: route === "all" ? "All routes" : routes.data?.find((r) => r.id === route)?.name ?? route, From: from, To: to }));
  const loading = !routes.data || !buses.data;

  return (
    <div>
      <PageHeader title="Reports" description="Usage, attendance and fines. Filter, then export to CSV or PDF." actions={
        <>
          <Button variant="outline" size="lg" onClick={() => exportCSV(rows(), "smartu-report")}><Download className="h-5 w-5" /> CSV</Button>
          <Button size="lg" onClick={() => exportPDF(rows(), "smartu-report", "SmartU Transport: usage report")}><FileText className="h-5 w-5" /> PDF</Button>
        </>
      } />
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <Select label="Route" value={route} onChange={(e) => setRoute(e.target.value)}><option value="all">All routes</option>{routes.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
          <Input label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Daily riders</CardTitle><CardDescription>Last 14 days (sample data)</CardDescription></div></CardHeader>
          <CardContent>
            <div className="h-72" role="img" aria-label="Line chart of daily riders over 14 days">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} stroke="rgb(var(--border))" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={axis} interval={2} /><YAxis tickLine={false} axisLine={false} tick={axis} /><Tooltip contentStyle={tip} /><Line type="monotone" dataKey="riders" stroke="rgb(var(--primary))" strokeWidth={3} dot={false} animationDuration={900} /></LineChart></ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Peak hours</CardTitle><CardDescription>Boardings by time of day</CardDescription></div></CardHeader>
          <CardContent>
            <div className="h-72" role="img" aria-label="Bar chart of boardings by hour">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={peak} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} stroke="rgb(var(--border))" /><XAxis dataKey="h" tickLine={false} axisLine={false} tick={axis} /><YAxis tickLine={false} axisLine={false} tick={axis} /><Tooltip contentStyle={tip} cursor={{ fill: "rgb(var(--muted))" }} /><Bar dataKey="riders" fill="rgb(var(--accent))" radius={[8, 8, 0, 0]} animationDuration={900} /></BarChart></ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Route usage</CardTitle><CardDescription>Riders per route in the selected range</CardDescription></div></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <div className="h-72" role="img" aria-label="Bar chart of riders per route">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={usage} layout="vertical" margin={{ left: 24, right: 16 }}><CartesianGrid horizontal={false} stroke="rgb(var(--border))" /><XAxis type="number" tickLine={false} axisLine={false} tick={axis} /><YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={axis} /><Tooltip contentStyle={tip} cursor={{ fill: "rgb(var(--muted))" }} /><Bar dataKey="riders" radius={[0, 8, 8, 0]} animationDuration={900}>{usage.map((u) => <Cell key={u.name} fill={u.color} />)}</Bar></BarChart></ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Fines by reason</CardTitle><CardDescription>Total value issued</CardDescription></div></CardHeader>
          <CardContent>
            {fines.isLoading ? <Skeleton className="h-72 w-full" /> : (
              <div className="h-72" role="img" aria-label="Pie chart of fines by reason">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={finesMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3} animationDuration={900}>{finesMix.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 14 }} /></PieChart></ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
