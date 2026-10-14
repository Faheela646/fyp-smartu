import * as S from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = ({ className, ...p }: React.ComponentProps<typeof S.Root>) => (
  <S.Root
    className={cn("peer inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-muted-foreground/40 transition-colors data-[state=checked]:bg-primary disabled:opacity-50", className)}
    {...p}
  >
    <S.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
  </S.Root>
);
