import { cn } from "@/lib/utils";

interface LogoProps {
  /** "full" = icon + wordmark, "mark" = icon only (cropped from the same artwork). */
  variant?: "full" | "mark";
  className?: string;
}

/** Official SmartU Transport logo (public/logo.png) on a white tile so it works on dark and light backgrounds. */
export function Logo({ variant = "full", className }: LogoProps) {
  if (variant === "mark") {
    return (
      <div className={cn("w-16 shrink-0 overflow-hidden rounded-md bg-white shadow-soft ring-1 ring-black/5", className)} style={{ aspectRatio: "350 / 210" }} role="img" aria-label="SmartU Transport">
        <img src="/logo.png" alt="" draggable={false} style={{ width: "122.3%", maxWidth: "none", marginLeft: "-11.4%", marginTop: "-20%" }} />
      </div>
    );
  }
  return (
    <div className={cn("w-full overflow-hidden rounded-md bg-white shadow-soft ring-1 ring-black/5", className)} style={{ aspectRatio: "410 / 280" }} role="img" aria-label="SmartU Transport, FAST-NUCES Chiniot">
      <img src="/logo.png" alt="" draggable={false} style={{ width: "104.4%", maxWidth: "none", marginLeft: "-2.4%", marginTop: "-17.5%" }} />
    </div>
  );
}
