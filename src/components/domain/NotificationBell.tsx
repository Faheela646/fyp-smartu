import { Bell, BellRing, Bus, CreditCard, Megaphone, Armchair, AlertTriangle, CalendarClock, Ticket, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { useRealtimeStore } from "@/store/realtime";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationKind } from "@/types/api";

const icons: Record<NotificationKind, typeof Bell> = {
  delay: Bus, schedule: CalendarClock, fine: AlertTriangle, fee: CreditCard,
  seat: Armchair, announcement: Megaphone, booking: Ticket, system: Info,
};

export function NotificationBell({ allHref }: { allHref: string }) {
  const notifications = useRealtimeStore((s) => s.notifications);
  const markAllRead = useRealtimeStore((s) => s.markAllRead);
  const markRead = useRealtimeStore((s) => s.markRead);
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`}>
          {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-danger-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <button className="text-xs font-medium text-primary hover:underline" onClick={markAllRead}>
            Mark all read
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {notifications.slice(0, 8).map((n) => {
            const Icon = icons[n.kind];
            return (
              <li key={n.id}>
                <button
                  onClick={() => markRead(n.id)}
                  className={cn("flex w-full gap-3 px-3 py-2.5 text-left hover:bg-muted", !n.read && "bg-primary-soft/40")}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.ts)}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button onClick={() => navigate(allHref)} className="w-full border-t border-border px-3 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted">
          View all
        </button>
      </DropdownContent>
    </DropdownMenu>
  );
}
