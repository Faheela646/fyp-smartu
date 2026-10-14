import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useRealtimeStore } from "@/store/realtime";
import { cn, timeAgo } from "@/lib/utils";

export function RecentNotifications({ limit = 5 }: { limit?: number }) {
  const list = useRealtimeStore((s) => s.notifications).slice(0, limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <EmptyState title="You're all caught up" description="New alerts will show up here in real time." />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((n) => (
              <li key={n.id} className="flex gap-3.5 py-3.5 first:pt-1">
                <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} aria-label={n.read ? undefined : "Unread"} />
                <div className="min-w-0">
                  <p className="text-base font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground/90">{timeAgo(n.ts)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
