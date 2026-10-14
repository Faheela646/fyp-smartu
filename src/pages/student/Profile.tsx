import { CalendarCheck, Mail, Phone, Route as RouteIcon, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useMe, useMyLogs } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { useAuthStore } from "@/store/auth";
import { ROLE_LABEL } from "@/app/nav";
import { timeAgo } from "@/lib/utils";

export default function Profile() {
  const user = useAuthStore((s) => s.user)!;
  const meQ = useMe();
  const logs = useMyLogs();
  const routes = useRoutes();
  const me = meQ.data;
  const mine = logs.data ?? [];
  const ok = mine.length;

  return (
    <div>
      <PageHeader title="My profile" description="Your account details and recent boarding attendance." />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardContent className="p-6 text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">{user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
            <h3 className="mt-4 text-xl font-extrabold">{user.name}</h3>
            <p className="text-muted-foreground">{user.identifier}</p>
            <div className="mt-3 flex justify-center gap-2"><Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>{me?.status === "BANNED" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}</div>
            <dl className="mt-6 space-y-4 text-left text-[15px]">
              <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-muted-foreground" /><dd className="break-all">{me?.email ?? user.email ?? "-"}</dd></div>
              <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-muted-foreground" /><dd>{me?.phone ?? "-"}</dd></div>
              <div className="flex items-center gap-3"><RouteIcon className="h-5 w-5 text-muted-foreground" /><dd>{routes.data?.find((r) => r.id === user.routeId)?.name ?? "-"}</dd></div>
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Boardings" value={ok} icon={ScanLine} tone="primary" loading={logs.isLoading} hint="Scans on record" />
            <StatCard label="This month" value={mine.filter((l) => l.ts.slice(0, 7) === new Date().toISOString().slice(0, 7)).length} icon={CalendarCheck} tone="success" loading={logs.isLoading} hint="Boardings" />
          </div>
          <Card>
            <CardHeader><CardTitle>Recent attendance</CardTitle></CardHeader>
            <CardContent>
              {logs.isLoading ? <Skeleton className="h-24 w-full" /> : mine.length === 0 ? <EmptyState icon={ScanLine} title="No scans yet" description="Your boarding scans will appear here." /> : (
                <ul className="divide-y divide-border">
                  {mine.slice(0, 8).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-3.5">
                      <div><p className="font-semibold">Route {l.routeNumber ?? "-"}</p><p className="text-sm text-muted-foreground">{timeAgo(l.ts)}{l.reason ? ` · ${l.reason}` : ""}</p></div>
                      <Badge tone={l.result === "MANUAL" ? "warning" : "success"}>{l.legs ? `${l.leg} of ${l.legs}` : "Manual"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
