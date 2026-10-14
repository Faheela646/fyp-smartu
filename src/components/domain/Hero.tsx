import { cn } from "@/lib/utils";

/** Page-top banner: fixed deep-blue gradient in both themes so white text always passes contrast. */
export function Hero({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br from-[#14307A] via-[#1D4ED8] to-[#2B6BF0] p-6 text-white shadow-raised sm:p-8", className)}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-white/5" />
      <div className="relative">{children}</div>
    </section>
  );
}
