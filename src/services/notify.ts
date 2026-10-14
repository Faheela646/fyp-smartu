import type { Audience, NotificationKind } from "@/types/api";
import { simulator } from "@/demo/simulator";
import { uid } from "@/demo/db";

/** Push a live notification. `audience` decides who sees it (undefined = everybody); recipients are filtered client-side. */
export function notify(title: string, body: string, kind: NotificationKind, audience?: Audience) {
  simulator.broadcast({
    type: "notification.new",
    payload: { id: uid("N"), kind, title, body, ts: new Date().toISOString(), read: false, audience },
  });
}
