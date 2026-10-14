import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SeatMapProps {
  total: number;
  taken: Set<number>;
  selected?: number | null;
  onSelect?: (n: number) => void;
  disabled?: boolean;
}

/** Bus layout: 2+2 seating with a centre aisle. Seat taken by someone else disappears (greys out) live. */
export function SeatMap({ total, taken, selected, onSelect, disabled }: SeatMapProps) {
  const rows = Math.ceil(total / 4);
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-border bg-muted/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between rounded-md bg-surface px-4 py-2.5 text-sm font-semibold text-muted-foreground shadow-soft">
        <span>Front</span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">Driver</span>
      </div>
      <div role="group" aria-label="Seat selection" className="space-y-2">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center justify-center gap-2">
            {[0, 1, "aisle", 2, 3].map((c) => {
              if (c === "aisle") return <span key="a" className="w-5 shrink-0" aria-hidden />;
              const n = r * 4 + (c as number) + 1;
              if (n > total) return <span key={n} className="h-11 w-11" />;
              const isTaken = taken.has(n);
              const isSel = selected === n;
              return (
                <motion.button
                  key={n}
                  type="button"
                  layout
                  whileTap={{ scale: isTaken || disabled ? 1 : 0.92 }}
                  disabled={isTaken || disabled}
                  onClick={() => onSelect?.(n)}
                  aria-label={`Seat ${n}, ${isTaken ? "taken" : isSel ? "selected" : "available"}`}
                  aria-pressed={isSel}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-md border-2 text-sm font-bold transition-colors",
                    isTaken && "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through",
                    !isTaken && !isSel && "border-border bg-surface hover:border-primary hover:bg-primary-soft",
                    isSel && "border-primary bg-primary text-primary-foreground shadow-soft",
                  )}
                >
                  {n}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border-2 border-border bg-surface" /> Available</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-primary" /> Yours</span>
        <span className="flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded bg-muted" /> Taken</span>
      </div>
    </div>
  );
}
