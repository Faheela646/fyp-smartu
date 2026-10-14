import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { announcementService, driverService, financeService, fleetService, registrationService, scanService, settingsService, studentService, violationService } from "@/services/ops";
import { errorMessage } from "@/services/http";

export const useStudents = () => useQuery({ queryKey: ["students"], queryFn: studentService.list });
/** The signed-in student's own record (students can't list everyone). */
export const useMe = () => useQuery({ queryKey: ["student-me"], queryFn: studentService.me });
export const useMyLogs = () => useQuery({ queryKey: ["my-logs"], queryFn: scanService.myLogs });
export const useDriversPublic = () => useQuery({ queryKey: ["drivers-public"], queryFn: driverService.listPublic, staleTime: 5 * 60_000 });
export const useFees = (userId?: string, enabled = true) => useQuery({ queryKey: ["fees", userId ?? "all"], queryFn: () => financeService.listFees(userId), enabled });
export const useFines = (userId?: string) => useQuery({ queryKey: ["fines", userId ?? "all"], queryFn: () => financeService.listFines(userId) });
export const useDrivers = () => useQuery({ queryKey: ["drivers"], queryFn: driverService.list });
export const useBills = (studentId?: string, enabled = true) => useQuery({ queryKey: ["bills", studentId ?? "all"], queryFn: () => financeService.listBills(studentId), enabled });
export const usePricing = () => useQuery({ queryKey: ["pricing"], queryFn: financeService.getPricing });
export const useFleetBuses = () => useQuery({ queryKey: ["fleet-buses"], queryFn: fleetService.listBuses });
export const useSchedules = () => useQuery({ queryKey: ["schedules"], queryFn: fleetService.listSchedules });
export const useAnnouncements = () => useQuery({ queryKey: ["announcements"], queryFn: announcementService.list });
export const useBookingEnabled = () => useQuery({ queryKey: ["booking-enabled"], queryFn: settingsService.getBookingEnabled });
export const useScanLogs = () => useQuery({ queryKey: ["scan-logs"], queryFn: scanService.logs });
export const useViolations = () => useQuery({ queryKey: ["violations"], queryFn: violationService.list });
export const useRegistrations = (userId?: string) => useQuery({ queryKey: ["registrations", userId ?? "all"], queryFn: () => registrationService.list(userId) });

/** Mutation that toasts success/failure and refreshes the listed query keys. */
export function useAction<V, R = unknown>(fn: (v: V) => Promise<R>, opts: { invalidate?: QueryKey[]; success?: string | ((r: R) => string); onSuccess?: (r: R) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(r) : opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e) => toast.error("Something went wrong", { description: errorMessage(e) }),
  });
}
