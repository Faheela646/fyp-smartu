import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Big number that slides when its value changes (seat availability). */
export function SeatCounter({ value, total, className }: { value: number; total: number; className?: string }) {
  const ratio = total ? value / total : 0;
  const tone = value === 0 ? "text-danger" : ratio < 0.25 ? "text-warning" : "text-success";
  return (
    <span className={cn("inline-flex items-baseline gap-1 tabular-nums", className)} aria-live="polite" aria-label={`${value} of ${total} seats available`}>
      <span className="relative inline-block h-[1.2em] min-w-[1.2ch] overflow-hidden align-bottom">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: "70%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-70%", opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn("block font-semibold", tone)}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="text-sm text-muted-foreground">/ {total}</span>
    </span>
  );
}
