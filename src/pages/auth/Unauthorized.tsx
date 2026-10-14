import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger">
          <ShieldAlert className="h-7 w-7" aria-hidden />
        </div>
        <h1>Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have permission to open this area.</p>
        <Button asChild className="mt-5">
          <Link to="/">Go to my dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
