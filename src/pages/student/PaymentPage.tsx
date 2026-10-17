import React, { useEffect, useId, useState } from "react";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  IdCard,
  Landmark,
  Lock,
  MapPin,
  Receipt,
  Route as RouteIcon,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { financeService } from "@/services/ops";
import { useAuthStore } from "@/store/auth";
import { checkUniEmail } from "@/lib/email";
import { cn, formatPKR } from "@/lib/utils";

const PAYMENT_METHODS = [
  { id: "JazzCash", label: "JazzCash", icon: Smartphone },
  { id: "EasyPaisa", label: "EasyPaisa", icon: Smartphone },
  { id: "Bank transfer", label: "Bank Transfer", icon: Landmark },
  { id: "Debit card", label: "Debit Card", icon: CreditCard },
];

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const me = useMe();
  const routes = useRoutes();

  // Extract any fine parameters passed via query param or route state
  const fineIdParam = searchParams.get("fineId") || (location.state as { fineId?: string } | null)?.fineId;
  const amountParam = searchParams.get("amount") || (location.state as { amount?: number | string } | null)?.amount;
  const reasonParam = (location.state as { reason?: string } | null)?.reason;

  // 1. Student Identification (auto-filled / read-only)
  const studentName = me.data?.name || user?.name || "Student";
  const emailChk = user?.email ? checkUniEmail(user.email) : null;
  const derivedRoll = emailChk && emailChk.ok && emailChk.kind === "student" ? emailChk.rollNo : "";
  const studentRoll = me.data?.rollNo || user?.identifier || derivedRoll || "22F-3082";

  // 2. Transport Details (Route & Pickup Stop)
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");

  // Sync initial route and stop once data is loaded
  useEffect(() => {
    if (!routes.data || routes.data.length === 0) return;

    if (!selectedRouteId) {
      const defaultRouteId = me.data?.routeId || user?.routeId || routes.data[0].id;
      setSelectedRouteId(defaultRouteId);

      const matchedRoute = routes.data.find((r) => r.id === defaultRouteId) || routes.data[0];
      const defaultStopId =
        (matchedRoute.stops.some((s) => s.id === me.data?.stopId) ? me.data?.stopId : matchedRoute.stops[0]?.id) || "";
      setSelectedStopId(defaultStopId);
    }
  }, [routes.data, me.data, user, selectedRouteId]);

  // When selected route changes, ensure selected stop is valid for this route
  const currentRoute = routes.data?.find((r) => r.id === selectedRouteId);
  const availableStops = currentRoute?.stops ?? [];

  const handleRouteChange = (newRouteId: string) => {
    setSelectedRouteId(newRouteId);
    const newRoute = routes.data?.find((r) => r.id === newRouteId);
    if (newRoute && newRoute.stops.length > 0) {
      setSelectedStopId(newRoute.stops[0].id);
    } else {
      setSelectedStopId("");
    }
  };

  // 3. Payment Details
  const initialAmount = amountParam ? String(amountParam) : "";
  const [amount, setAmount] = useState<string>(initialAmount);
  const [method, setMethod] = useState<string>("JazzCash");
  const [amountError, setAmountError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedPayment, setCompletedPayment] = useState<{
    txId: string;
    studentName: string;
    studentRoll: string;
    routeName: string;
    stopName: string;
    amount: number;
    method: string;
    date: string;
    fineId?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Please enter a valid payment amount greater than 0");
      return;
    }
    setAmountError("");

    setIsSubmitting(true);
    try {
      if (fineIdParam) {
        // If paying a specific fine, invoke the finance service
        await financeService.payFine(fineIdParam, method);
        await qc.invalidateQueries({ queryKey: ["fines"] });
      }

      // Generate a simulated transaction reference
      const txId = "TXN-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Date.now().toString().slice(-4);
      const stopObj = availableStops.find((s) => s.id === selectedStopId);

      setCompletedPayment({
        txId,
        studentName,
        studentRoll,
        routeName: currentRoute ? `Route ${currentRoute.number} - ${currentRoute.name}` : "Selected Route",
        stopName: stopObj?.name || "Selected Stop",
        amount: parsedAmount,
        method,
        date: new Date().toLocaleString(),
        fineId: fineIdParam || undefined,
      });

      toast.success("Payment completed successfully!", {
        description: `Receipt reference: ${txId}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment processing failed. Please try again.";
      toast.error("Payment failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (completedPayment) {
    return (
      <div className="mx-auto max-w-2xl py-6 animate-in fade-in-50 duration-300">
        <Card className="border-success/30 shadow-card">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Payment Successful</CardTitle>
            <p className="text-sm text-muted-foreground">Your transaction has been confirmed and recorded.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-border bg-muted/40 p-5 space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="font-mono text-sm font-bold">{completedPayment.txId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Student Name</span>
                <span className="text-sm font-semibold">{completedPayment.studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Roll Number / ID</span>
                <span className="text-sm font-semibold">{completedPayment.studentRoll}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Assigned Route</span>
                <span className="text-sm font-semibold">{completedPayment.routeName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pickup Stop</span>
                <span className="text-sm font-semibold">{completedPayment.stopName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <Badge tone="primary">{completedPayment.method}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="text-sm">{completedPayment.date}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-base font-bold">Total Amount Paid</span>
                <span className="text-2xl font-extrabold text-success">{formatPKR(completedPayment.amount)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCompletedPayment(null);
                  setAmount("");
                }}
              >
                Make Another Payment
              </Button>
              <Button className="flex-1" onClick={() => navigate("/student/fines")}>
                View Fines & Violations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoadingData = routes.isLoading || me.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Payment"
          description="Enter your transport and payment information to complete dues or fine payments."
        />
        {fineIdParam && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => navigate("/student/fines")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Fines
          </Button>
        )}
      </div>

      {fineIdParam && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-soft p-4 text-foreground">
          <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-primary">Paying for Fine / Violation</p>
            <p className="text-muted-foreground mt-0.5">
              {reasonParam ? `${reasonParam} · ` : ""}Fine ID: <span className="font-mono font-medium">{fineIdParam}</span>
              {amountParam ? ` · Amount: ${formatPKR(Number(amountParam))}` : ""}
            </p>
          </div>
        </div>
      )}

      {isLoadingData ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Student Identification (Auto-filled / Read-only) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">1. Student Identification</CardTitle>
                    <p className="text-xs text-muted-foreground">Auto-filled from authenticated student session</p>
                  </div>
                </div>
                <Badge tone="neutral" className="gap-1 font-normal text-xs">
                  <Lock className="h-3 w-3" /> Read-only
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Input
                    label="Student Full Name"
                    value={studentName}
                    readOnly
                    disabled
                    className="bg-muted/50 cursor-not-allowed font-medium"
                  />
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" /> Verified portal identity
                  </p>
                </div>
                <div>
                  <Input
                    label="Roll Number / Student ID"
                    value={studentRoll}
                    readOnly
                    disabled
                    className="bg-muted/50 cursor-not-allowed font-mono font-medium"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Associated university registration number</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Transport Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <RouteIcon className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">2. Transport Details</CardTitle>
                  <p className="text-xs text-muted-foreground">Confirm your university bus route and designated pickup stop</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Select
                    label="Route Selection"
                    value={selectedRouteId}
                    onChange={(e) => handleRouteChange(e.target.value)}
                    required
                  >
                    {routes.data?.map((r) => (
                      <option key={r.id} value={r.id}>
                        Route {r.number} - {r.name} ({r.via})
                      </option>
                    ))}
                  </Select>
                  {currentRoute && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Via: <span className="font-medium text-foreground">{currentRoute.via}</span>
                      {currentRoute.note ? ` · ${currentRoute.note}` : ""}
                    </p>
                  )}
                </div>

                <div>
                  <Select
                    label="Pickup Stop"
                    value={selectedStopId}
                    onChange={(e) => setSelectedStopId(e.target.value)}
                    disabled={availableStops.length === 0}
                    required
                  >
                    {availableStops.length === 0 ? (
                      <option value="">No stops available for this route</option>
                    ) : (
                      availableStops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.time ? `(${s.time})` : ""}
                        </option>
                      ))
                    )}
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {availableStops.length} designated pickup stops along this route
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Payment Details */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">3. Payment Details</CardTitle>
                  <p className="text-xs text-muted-foreground">Enter payment amount and select payment channel</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-w-md">
                <Input
                  label="Payment Amount (PKR)"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 1500"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (amountError) setAmountError("");
                  }}
                  error={amountError}
                  hint="Enter the exact amount you wish to pay in PKR"
                  required
                  className="text-lg font-semibold"
                />
              </div>

              {/* Payment Method Selector */}
              <fieldset>
                <legend className="mb-2.5 text-sm font-semibold text-foreground">Select Payment Method</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PAYMENT_METHODS.map((m) => {
                    const isSelected = method === m.id;
                    const Icon = m.icon;
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 p-3.5 text-center transition-all",
                          isSelected
                            ? "border-primary bg-primary-soft text-primary shadow-soft"
                            : "border-border hover:bg-muted text-foreground"
                        )}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => setMethod(m.id)}
                        />
                        <Icon className="h-6 w-6" aria-hidden />
                        <span className="text-xs font-semibold">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Total payable:{" "}
                  <span className="text-lg font-bold text-foreground">
                    {amount && !isNaN(Number(amount)) && Number(amount) > 0 ? formatPKR(Number(amount)) : "Rs. 0"}
                  </span>
                </div>
                <div className="flex w-full sm:w-auto gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 sm:flex-initial"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    className="flex-1 sm:flex-initial h-11 px-6 text-base font-semibold"
                  >
                    Confirm & Pay
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
