import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
  prefix?: string;
  hint?: string;
  tone?: "primary" | "accent" | "success" | "warning" | "danger";
  loading?: boolean;
}

const tones = {
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success text-white dark:text-background",
  warning: "bg-warning text-white dark:text-background",
  danger: "bg-danger text-danger-foreground",
};

export function StatCard({ label, value, icon: Icon, suffix, prefix, hint, tone = "primary", loading }: StatCardProps) {
  const animated = useCountUp(value);
  return (
    <Card className="p-5 sm:p-6">
      <div className={cn("mb-4 grid h-12 w-12 place-items-center rounded-md shadow-soft", tones[tone])}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-base font-semibold text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-12 w-28" />
      ) : (
        <p className="mt-1 flex items-baseline gap-1.5 text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight">
          <span>
            {prefix}
            {Math.round(animated).toLocaleString()}
          </span>
          {suffix && <span className="text-xl font-semibold text-muted-foreground">{suffix}</span>}
        </p>
      )}
      {hint && <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">{hint}</p>}
    </Card>
  );
}
