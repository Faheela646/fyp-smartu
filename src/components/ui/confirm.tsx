import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

interface ConfirmProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  /** Extra content, e.g. a rule warning. */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, children, confirmLabel = "Confirm", cancelLabel = "Keep it", tone = "primary", loading, onConfirm }: ConfirmProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Callout({ tone = "warning", title, children }: { tone?: "warning" | "danger" | "info" | "success"; title?: string; children: React.ReactNode }) {
  const cls = { warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger", info: "bg-primary-soft text-primary", success: "bg-success-soft text-success" }[tone];
  return (
    <div role="note" className={`flex gap-3 rounded-md p-4 ${cls}`}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="text-sm">
        {title && <p className="font-bold">{title}</p>}
        <div className={title ? "mt-0.5 font-medium" : "font-medium"}>{children}</div>
      </div>
    </div>
  );
}
