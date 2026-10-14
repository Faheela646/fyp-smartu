import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** "center" dialog, or "left"/"bottom" sheet (drawer on mobile). */
  variant?: "center" | "left" | "bottom";
  className?: string;
}

export function Modal({ open, onOpenChange, title, description, children, variant = "center", className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content
          className={cn(
            "fixed z-[1210] border border-border bg-surface shadow-raised duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            variant === "center" &&
              "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg p-5 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:fade-out-0",
            variant === "left" && "inset-y-0 left-0 w-72 max-w-[85vw] p-4 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
            variant === "bottom" && "inset-x-0 bottom-0 rounded-t-lg p-5 safe-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            className,
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className={cn("text-sm text-muted-foreground", !description && "sr-only")}>{description ?? title}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
