import { useRealtimeStore } from "@/store/realtime";
import { DEMO_MODE } from "@/services/wsClient";
import { cn } from "@/lib/utils";

const map = {
  online: { label: "Live", dot: "bg-success", text: "text-success" },
  connecting: { label: "Connecting", dot: "bg-warning", text: "text-warning" },
  reconnecting: { label: "Reconnecting", dot: "bg-warning", text: "text-warning" },
  offline: { label: "Offline", dot: "bg-danger", text: "text-danger" },
} as const;

export function ConnectionStatus() {
  const status = useRealtimeStore((s) => s.status);
  const m = map[status];
  return (
    <div
      role="status"
      aria-label={`Realtime connection: ${m.label}`}
      className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-2 text-xs font-medium sm:py-1"
    >
      <span className="relative flex h-2 w-2">
        {status === "online" && <span className={cn("absolute inline-flex h-full w-full animate-pulseRing rounded-full", m.dot)} />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", m.dot)} />
      </span>
      <span className={cn(m.text, "hidden sm:inline")}>{m.label}</span>
      {DEMO_MODE && <span className="hidden border-l border-border pl-2 text-muted-foreground sm:inline">Demo</span>}
    </div>
  );
}
