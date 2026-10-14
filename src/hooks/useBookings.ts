import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bookingService, type NewBooking } from "@/services/bookings";
import { errorMessage } from "@/services/http";
import type { BookingRecord } from "@/types/api";

export const useMyBookings = (userId: string) => useQuery({ queryKey: ["bookings", userId], queryFn: () => bookingService.listMine(userId) });
export const useAllBookings = () => useQuery({ queryKey: ["bookings", "all"], queryFn: bookingService.listAll });
export const useBusBookings = (busId?: string) => useQuery({ queryKey: ["bookings", "bus", busId], queryFn: () => bookingService.listForBus(busId!), enabled: !!busId });

/** Optimistic: the new booking shows immediately and is rolled back if the server rejects it. */
export function useCreateBooking(userId: string) {
  const qc = useQueryClient();
  const key = ["bookings", userId];
  return useMutation({
    mutationFn: (req: NewBooking) => bookingService.create(req),
    onMutate: async (req) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BookingRecord[]>(key);
      const temp: BookingRecord = {
        id: "pending", userId, busId: req.busId, routeId: "", date: req.date, type: req.type, price: 0, status: "CONFIRMED",
        tripType: req.tripType, direction: req.direction, usesAllowed: req.tripType === "TWO_WAY" ? 2 : 1, usesDone: 0, expiresAt: new Date().toISOString(),
        seatNo: req.seatNo, departTime: "--:--", routeName: "Confirming…", routeNumber: "", plate: "", createdAt: new Date().toISOString(),
      };
      qc.setQueryData<BookingRecord[]>(key, [temp, ...(prev ?? [])]);
      return { prev };
    },
    onError: (e, _req, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Booking failed", { description: errorMessage(e) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useCancelBooking(userId: string) {
  const qc = useQueryClient();
  const key = ["bookings", userId];
  return useMutation({
    mutationFn: (id: string) => bookingService.cancel(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BookingRecord[]>(key);
      qc.setQueryData<BookingRecord[]>(key, (prev ?? []).map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b)));
      return { prev };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Couldn't cancel", { description: errorMessage(e) });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["fines"] });
    },
  });
}
