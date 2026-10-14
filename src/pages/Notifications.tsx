import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Segmented } from "@/components/ui/form";
import { useRealtimeStore } from "@/store/realtime";
import { cn, timeAgo } from "@/lib/utils";

export default function Notifications() {
  const list = useRealtimeStore((s) => s.notifications);
  const markAll = useRealtimeStore((s) => s.markAllRead);
  const markRead = useRealtimeStore((s) => s.markRead);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const shown = filter === "unread" ? list.filter((n) => !n.read) : list;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Live alerts about delays, schedule changes, fees, fines and seats."
        actions={
          <>
            <Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread (${list.filter((n) => !n.read).length})` }]} />
            <Button variant="outline" onClick={markAll}><CheckCheck className="h-4 w-4" /> Mark all read</Button>
          </>
        }
      />
      {shown.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="New notifications arrive here instantly." />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((n) => (
              <li key={n.id}>
                <button onClick={() => markRead(n.id)} className={cn("flex w-full items-start gap-4 p-5 text-left hover:bg-muted/50", !n.read && "bg-primary-soft/40")}>
                  <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", n.read ? "bg-border" : "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-base font-bold">{n.title}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">{timeAgo(n.ts)}</span>
                    </span>
                    <span className="mt-0.5 block text-[15px] text-muted-foreground">{n.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
