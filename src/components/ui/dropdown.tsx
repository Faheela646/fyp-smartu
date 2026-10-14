import * as D from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = D.Root;
export const DropdownTrigger = D.Trigger;
export const DropdownContent = ({ className, sideOffset = 8, ...p }: React.ComponentProps<typeof D.Content>) => (
  <D.Portal>
    <D.Content
      sideOffset={sideOffset}
      className={cn(
        "z-[1300] min-w-[12rem] rounded-md border border-border bg-surface p-1 shadow-raised data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-150",
        className,
      )}
      {...p}
    />
  </D.Portal>
);
export const DropdownItem = ({ className, ...p }: React.ComponentProps<typeof D.Item>) => (
  <D.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2.5 text-[15px] font-medium outline-none data-[highlighted]:bg-muted", className)} {...p} />
);
export const DropdownLabel = ({ className, ...p }: React.ComponentProps<typeof D.Label>) => (
  <D.Label className={cn("px-2.5 py-1.5 text-xs text-muted-foreground", className)} {...p} />
);
export const DropdownSeparator = () => <D.Separator className="my-1 h-px bg-border" />;
