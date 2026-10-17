import { useNavigate } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useFines } from "@/hooks/useOps";
import { useAuthStore } from "@/store/auth";
import { formatPKR } from "@/lib/utils";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const tone = { UNPAID: "danger", PAID: "success", WAIVED: "neutral" } as const;

export default function Fines() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)!;
  const fines = useFines(user.id);

  const list = fines.data ?? [];
  const owed = list.filter((f) => f.status === "UNPAID").reduce((a, f) => a + f.amount, 0);

  return (
    <div>
      <PageHeader title="Fines & violations" description="Any penalties issued by the Transport Office or the system show up here." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Unpaid fines" value={owed} prefix="Rs. " icon={AlertTriangle} tone={owed ? "danger" : "success"} loading={fines.isLoading} />
        <StatCard label="Total on record" value={list.length} icon={ShieldCheck} tone="primary" loading={fines.isLoading} />
      </div>
      <Card>
        <CardContent className="p-0 sm:p-0">
          {fines.isError ? <div className="p-5"><ErrorState onRetry={() => fines.refetch()} /></div> : fines.isLoading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : list.length === 0 ? (
            <div className="p-5"><EmptyState icon={ShieldCheck} title="Clean record" description="You have no fines or violations. Keep it up!" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((f) => (
                <li key={f.id} className="flex flex-col gap-3 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-bold sm:text-lg">{f.reason}</p>
                    <p className="text-sm sm:text-base text-muted-foreground">{fmt(f.date)} · issued by {f.issuedBy}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={tone[f.status]}>{f.status === "UNPAID" ? "Unpaid" : f.status === "PAID" ? "Paid" : "Waived"}</Badge>
                    <span className="min-w-[90px] text-right text-lg sm:text-xl font-extrabold">{formatPKR(f.amount)}</span>
                    {f.status === "UNPAID" && (
                      <Button
                        size="sm"
                        className="h-10 px-4 text-base font-semibold"
                        onClick={() =>
                          navigate(`/student/payment?fineId=${f.id}&amount=${f.amount}`, {
                            state: { fineId: f.id, amount: f.amount, reason: f.reason },
                          })
                        }
                      >
                        Pay
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
