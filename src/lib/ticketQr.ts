/** QR payload of a ticket. `ts` rotates every 30 s on the student's phone so a screenshot goes stale. */
export interface TicketQr {
  v: 2;
  tid: string;
  sid: string;
  ts: number;
}

export const buildTicketQr = (t: { id: string; userId: string }, now = Date.now()): string =>
  JSON.stringify({ v: 2, tid: t.id, sid: t.userId, ts: now } satisfies TicketQr);

export function parseTicketQr(raw: string): TicketQr | null {
  try {
    const p = JSON.parse(raw) as Partial<TicketQr>;
    if (p && p.v === 2 && typeof p.tid === "string" && typeof p.sid === "string" && typeof p.ts === "number") return p as TicketQr;
  } catch {
    /* not JSON */
  }
  return null;
}
