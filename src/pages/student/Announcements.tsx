import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAnnouncements } from "@/hooks/useOps";
import { useAuthStore } from "@/store/auth";
import { timeAgo } from "@/lib/utils";

export default function Announcements() {
  const role = useAuthStore((s) => s.user!.role);
  const q = useAnnouncements();
  const list = (q.data ?? []).filter((a) => a.audience === "ALL" || a.audience === role);
  return (
    <div>
      <PageHeader title="Announcements" description="Official updates from the Transport Office and the Dean of Students." />
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" description="You'll see official notices here." />
      ) : (
        <ul className="space-y-4">
          {list.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary"><Megaphone className="h-5 w-5" /></span>
                    <h3 className="flex-1 text-lg font-bold">{a.title}</h3>
                    {a.audience !== "ALL" && <Badge tone="accent">{a.audience === "HOSTELITE" ? "Hostelites" : "Day scholars"}</Badge>}
                  </div>
                  <p className="mt-3 text-base leading-relaxed">{a.body}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{a.author} · {timeAgo(a.ts)}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
