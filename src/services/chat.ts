import { DEMO_BUSES, DEMO_ROUTES } from "@/demo/data";
import { useDemoDB } from "@/demo/db";
import { distanceKm } from "@/lib/geo";
import { formatPKR } from "@/lib/utils";
import { useRealtimeStore } from "@/store/realtime";
import type { User } from "@/types/api";
import { DEMO_MODE } from "./wsClient";
import { http, wait } from "./http";

/** Rule-based answers over live data (demo). Real mode calls the backend chatbot. */
function localAnswer(q: string, user: User): string {
  const t = q.toLowerCase();
  const rt = useRealtimeStore.getState();
  const db = useDemoDB.getState();
  const myBus = DEMO_BUSES.find((b) => b.routeId === user.routeId) ?? DEMO_BUSES[0];
  const myRoute = DEMO_ROUTES.find((r) => r.id === myBus.routeId)!;
  const p = db.pricing;

  if (/(seat|available|free|space|full|capacity)/.test(t) && !/cancel|book/.test(t)) {
    const s = rt.seats[myBus.id];
    const withSeats = DEMO_BUSES.filter((b) => (rt.seats[b.id]?.seatsAvailable ?? 0) > 0).length;
    return s
      ? `Your route is ${myRoute.name} (${myRoute.via}). Right now ${s.seatsAvailable} of ${s.seatsTotal} seats are free${s.seatsAvailable === 0 ? ` and ${s.standingAvailable} standing spots` : ""}. ${withSeats} of ${DEMO_BUSES.length} routes still have seats. Open Book Ticket to compare them.`
      : "I'm still waiting for live seat data. Please try again in a few seconds.";
  }
  if (/(eta|arrive|when|where|late|how long|bus|timing|time)/.test(t) && !/book|cancel|ticket|valid|expire/.test(t)) {
    const pos = rt.buses[myBus.id];
    const stop = myRoute.stops.find((s) => s.id === db.students.find((x) => x.id === user.id)?.stopId);
    if (!pos) return "I'm still waiting for the bus's GPS signal. Please try again in a few seconds.";
    const end = myRoute.stops[myRoute.stops.length - 1];
    const km = distanceKm([pos.lat, pos.lng], [end.lat, end.lng]);
    const min = Math.max(1, Math.round((km / Math.max(22, pos.speedKmh)) * 60));
    return `Your bus (${myBus.plate}) on ${myRoute.name} is about ${km.toFixed(1)} km from campus at ${pos.speedKmh} km/h, so roughly ${min} min away.${stop ? ` Timetable pick-up at ${stop.name}: ${stop.time}.` : ""}`;
  }
  if (/(cancel)/.test(t)) {
    return `Open Book Ticket → My active tickets → Cancel. Cancelling at least ${p.freeCancelHours} hours before departure is free; after that ${p.cancelFeePercent}% of the price is charged and added to your fines. A ticket that has already been scanned can't be cancelled.`;
  }
  if (/(qr|valid|expire|dispose|reuse|one.?way|two.?way|use again|scan)/.test(t)) {
    return `Your QR comes from the ticket you book. A one-way ticket works for ONE scan; a two-way ticket works for TWO (going and coming back). It is disposed automatically after its scans are used up, or ${p.ticketValidHours} hours after the trip starts, whichever comes first. Then you book again to get a new QR.`;
  }
  if (/(book|reserve|ticket|standing)/.test(t)) {
    const price = user.role === "HOSTELITE" ? `A seat costs ${formatPKR(p.seatPrice)} per trip (two-way = two trips) and a standing ticket ${formatPKR(p.standingPrice)}; it is added to your monthly bill.` : "Your rides are covered by your semester fee, so tickets are free.";
    return `Open Book Ticket, choose the route, date, and one-way or two-way, pick a seat, then confirm. ${price} If the bus is full you can take a standing ticket.${db.bookingEnabled ? "" : " ⚠️ Booking is currently paused by the Transport Office."}`;
  }
  if (/(fee|pay|due|voucher|bill|challan)/.test(t)) {
    if (user.role === "HOSTELITE") {
      const unpaid = db.bills.filter((b) => b.studentId === user.id && b.status === "UNPAID");
      const total = unpaid.reduce((a, b) => a + b.amount, 0);
      return total ? `You have ${unpaid.length} unpaid monthly bill(s) totalling ${formatPKR(total)}. Hostelites are billed monthly from the tickets they book. Open Monthly Fee to download the challan and pay.` : "Your monthly bills are all paid. 🎉 Hostelites are billed every month from the tickets they book.";
    }
    const unpaid = db.fees.filter((f) => f.userId === user.id && (f.status === "UNPAID" || f.status === "REJECTED"));
    const waiting = db.fees.filter((f) => f.userId === user.id && f.status === "SUBMITTED").length;
    const total = unpaid.reduce((a, f) => a + f.amount, 0);
    return waiting ? "Your semester fee payment was submitted and is waiting for the Transport Office to approve it." : total ? `Your semester fee of ${formatPKR(total)} is unpaid. Download the challan under Semester Fee, pay at the bank, then submit the receipt reference for approval.` : "Your semester transport fee is paid. 🎉";
  }
  if (/(fine|violation|penalt|ban)/.test(t)) {
    const owed = db.fines.filter((f) => f.userId === user.id && f.status === "UNPAID").reduce((a, f) => a + f.amount, 0);
    return owed ? `You have ${formatPKR(owed)} in unpaid fines. See Fines & Violations to review and pay them.` : "You have no unpaid fines.";
  }
  if (/(route|stop)/.test(t)) return `There are ${DEMO_ROUTES.length} university routes (Route 01 to Route ${DEMO_ROUTES[DEMO_ROUTES.length - 1].number}). Yours is ${myRoute.name}: ${myRoute.via}. Open Live Map to see any route's stops and times.`;
  if (/(hello|hi|hey|salam)/.test(t)) return `Hi ${user.name.split(" ")[0]}! I can help with live seats, bus ETA, booking tickets, cancellations, fees and fines. What do you need?`;
  return "I can help with seat availability, bus ETA, booking and cancelling tickets, how your QR works, fees and fines. Try asking, e.g. “How long is my ticket valid?”";
}

/** Streams the reply word-by-word. */
export async function* streamReply(question: string, user: User): AsyncGenerator<string> {
  let text: string;
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, import.meta.env.MODE === "test" ? 0 : 450 + Math.random() * 250)); // "thinking" (typing dots)
    text = localAnswer(question, user);
  } else {
    text = (await http.post<{ reply: string }>("/chatbot", { message: question })).data.reply;
  }
  const words = text.split(/(\s+)/);
  for (const w of words) {
    yield w;
    await wait(18 + Math.random() * 30);
  }
}
