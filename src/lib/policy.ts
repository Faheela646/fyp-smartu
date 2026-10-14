import type { Pricing, ViolationAction, ViolationReport, ViolationType } from "@/types/api";

export interface PolicyDecision {
  offenceNo: number;
  action: Extract<ViolationAction, "FINED" | "DDC">;
  amount?: number;
  reason: string;
}

/** Violations that skip the ladder and go straight to the Disciplinary Committee. */
export const DIRECT_DDC: ViolationType[] = ["Vape / pod found"];

/**
 * Transport violation policy:
 *   1st offence  → fine (default Rs. 1,000)
 *   2nd offence  → fine (default Rs. 5,000)
 *   3rd+ offence → referred to the DDC
 *   Vape / pod found → referred to the DDC directly, whatever the history
 */
export function decidePolicy(type: ViolationType, priorOffences: number, p: Pick<Pricing, "firstOffenceFine" | "secondOffenceFine">): PolicyDecision {
  const offenceNo = priorOffences + 1;
  if (DIRECT_DDC.includes(type)) return { offenceNo, action: "DDC", reason: `${type}: direct DDC referral (no fine ladder)` };
  if (offenceNo === 1) return { offenceNo, action: "FINED", amount: p.firstOffenceFine, reason: "1st offence: fine" };
  if (offenceNo === 2) return { offenceNo, action: "FINED", amount: p.secondOffenceFine, reason: "2nd offence: fine" };
  return { offenceNo, action: "DDC", reason: `Offence #${offenceNo}: referred to DDC` };
}

/** Earlier decided offences (fined or sent to the DDC) of the same student, not counting `self`. */
export function priorOffences(all: ViolationReport[], studentId: string, selfId?: string): number {
  return all.filter((v) => v.studentId === studentId && v.id !== selfId && (v.action === "FINED" || v.action === "DDC")).length;
}

export function buildDdcMail(v: ViolationReport, history: ViolationReport[], ddcEmail: string) {
  const prior = history.filter((h) => h.studentId === v.studentId && h.id !== v.id && h.action);
  const lines = [
    "Dear Members of the DDC,",
    "",
    "The Transport Office is referring the following student for disciplinary review.",
    "",
    `Student: ${v.studentName}`,
    `Roll no.: ${v.rollNo}`,
    `Violation: ${v.type}`,
    `Date reported: ${new Date(v.ts).toLocaleString("en-GB")}`,
    `Bus route: ${v.routeNumber ? `Route ${v.routeNumber}` : "n/a"}${v.plate ? ` (bus ${v.plate})` : ""}`,
    `Reported by (conductor): ${v.reportedBy}`,
    `Conductor's notes: ${v.notes}`,
    `Offence number: ${v.offenceNo ?? prior.length + 1}`,
    "",
    prior.length ? "Previous offences on record:" : "No previous offences on record.",
    ...prior.map((h, i) => `  ${i + 1}. ${new Date(h.ts).toLocaleDateString("en-GB")}: ${h.type} → ${h.action === "FINED" ? `fined Rs. ${h.fineAmount}` : "referred to DDC"}`),
    "",
    DIRECT_DDC.includes(v.type) ? "Under the transport policy this violation is referred directly to the DDC." : "Under the transport policy (1st: Rs. 1,000, 2nd: Rs. 5,000, 3rd: DDC) this case now goes to the DDC.",
    "",
    "Kind regards,",
    "Transport Office, FAST-NUCES Chiniot-Faisalabad Campus",
  ];
  const subject = `DDC referral: ${v.studentName} (${v.rollNo}): ${v.type}`;
  const body = lines.join("\n");
  return { to: ddcEmail, subject, body, mailto: `mailto:${ddcEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
