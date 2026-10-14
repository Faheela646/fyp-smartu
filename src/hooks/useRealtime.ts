import { useEffect } from "react";
import { toast } from "sonner";
import { createRealtimeClient } from "@/services/wsClient";
import { useAuthStore } from "@/store/auth";
import { useRealtimeStore } from "@/store/realtime";
import { useDemoDB } from "@/demo/db";
import { isVisibleTo } from "@/lib/audience";
import { DEMO_MODE } from "@/services/wsClient";

/** Opens the realtime connection while a user is signed in and feeds the store. */
export function useRealtimeConnection(enabled = true) {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token || !enabled) return;
    const store = useRealtimeStore.getState();
    if (DEMO_MODE) store.setBookingEnabled(useDemoDB.getState().bookingEnabled);
    store.resetNotifications(useAuthStore.getState().user);
    const client = createRealtimeClient(() => useAuthStore.getState().token);

    const offStatus = client.onStatus(store.setStatus);
    // GPS fixes arrive in bursts (one per bus per tick): coalesce them into a single store update.
    let pending: import("@/types/api").BusPosition[] = [];
    const flush = () => { const batch = pending; pending = []; if (batch.length) useRealtimeStore.getState().setPositions(batch); };
    const offEvents = client.subscribe((e) => {
      const s = useRealtimeStore.getState();
      switch (e.type) {
        case "bus.position":
          if (!pending.length) queueMicrotask(flush);
          pending.push(e.payload);
          return;
        case "seats.updated":
          return s.setSeats(e.payload);
        case "trip.status":
          return s.setTrip(e.payload.busId, e.payload.active);
        case "booking.toggled":
          return s.setBookingEnabled(e.payload.enabled);
        case "notification.new": {
          // RBAC: a student only receives their own information, announcements for their group and their route's alerts.
          if (!isVisibleTo(e.payload.audience, useAuthStore.getState().user)) return;
          s.addNotification(e.payload);
          toast(e.payload.title, { description: e.payload.body });
        }
      }
    });

    client.connect();
    return () => {
      offStatus();
      offEvents();
      client.disconnect();
    };
  }, [token, enabled]);
}
