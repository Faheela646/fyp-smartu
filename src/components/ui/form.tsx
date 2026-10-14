import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
}

/** Native <select> (best mobile UX + accessibility) styled to match Input. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  ({ className, label, error, hint, id, children, ...props }, ref) => {
    const auto = React.useId();
    const sid = id ?? auto;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={sid} className="text-sm font-semibold">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={sid}
            aria-invalid={!!error}
            className={cn("h-12 w-full appearance-none rounded-md border border-border bg-surface pl-4 pr-10 text-base", error && "border-danger", className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        {(error || hint) && <p role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-danger" : "text-muted-foreground")}>{error ?? hint}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const auto = React.useId();
    const tid = id ?? auto;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={tid} className="text-sm font-semibold">
            {label}
          </label>
        )}
        <textarea ref={ref} id={tid} aria-invalid={!!error} rows={4} className={cn("w-full rounded-md border border-border bg-surface px-4 py-3 text-base placeholder:text-muted-foreground", error && "border-danger", className)} {...props} />
        {(error || hint) && <p role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-danger" : "text-muted-foreground")}>{error ?? hint}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("h-2.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-sm px-4 py-2 text-sm font-semibold transition-colors", value === o.value ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
