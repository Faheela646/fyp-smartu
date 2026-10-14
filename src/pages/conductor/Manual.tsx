import { useState } from "react";
import { Search, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useAssignedBus } from "@/hooks/useConductorBus";
import { useAction, useScanLogs, useStudents } from "@/hooks/useOps";
import { scanService } from "@/services/ops";
import { timeAgo } from "@/lib/utils";

export default function Manual() {
  const { user, bus } = useAssignedBus();
  const students = useStudents();
  const logs = useScanLogs();
  const [q, setQ] = useState("");
  const mark = useAction((id: string) => scanService.manual(id, bus!.id, user.name), { invalidate: [["scan-logs"]], success: (s) => `${(s as { name: string }).name} marked present` });

  const needle = q.trim().toLowerCase();
  const matches = needle.length < 2 ? [] : (students.data ?? []).filter((s) => s.name.toLowerCase().includes(needle) || s.rollNo.toLowerCase().includes(needle)).slice(0, 6);
  const recent = (logs.data ?? []).filter((l) => l.result === "MANUAL").slice(0, 6);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Manual attendance" description="Use this when a QR scan fails: damaged phone, poor light or no signal." />
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Roll number or name…" aria-label="Find student" className="h-14 w-full rounded-md border border-border bg-surface pl-12 pr-4 text-lg" />
          </div>
          {students.isLoading ? <Skeleton className="h-20 w-full" /> : needle.length >= 2 && matches.length === 0 ? (
            <EmptyState title="No student found" description="Check the spelling or roll number." />
          ) : (
            <ul className="space-y-2">
              {matches.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.rollNo} · {s.residence === "HOSTELITE" ? "Hostelite" : "Day scholar"}</p>
                  </div>
                  {s.status === "BANNED" ? <Badge tone="danger">Suspended</Badge> : <Button loading={mark.isPending && mark.variables === s.id} onClick={() => mark.mutate(s.id)}><UserCheck className="h-5 w-5" /> Mark present</Button>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader><CardTitle>Recent manual entries</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? <EmptyState title="None yet" /> : (
            <ul className="divide-y divide-border">
              {recent.map((l) => <li key={l.id} className="flex justify-between gap-3 py-3"><span className="font-semibold">{l.studentName} <span className="font-normal text-muted-foreground">· {l.rollNo}</span></span><span className="text-sm text-muted-foreground">{timeAgo(l.ts)}</span></li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
