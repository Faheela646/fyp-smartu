/**
 * University email rules (domain @cfd.nu.edu.pk):
 *   student  → one letter (campus), 2-digit batch, 4-digit roll number:  f223284@cfd.nu.edu.pk  → roll no. 22F-3284
 *   others   → the person's name (teachers, conductors, staff):         saaqib.ameer@cfd.nu.edu.pk
 */
export const UNI_DOMAIN = "cfd.nu.edu.pk";

export type EmailCheck =
  | { ok: true; kind: "student"; email: string; campus: string; batch: string; roll: string; rollNo: string }
  | { ok: true; kind: "staff"; email: string; handle: string }
  | { ok: false; code: "empty" | "invalid" | "domain" | "local"; message: string };

const STUDENT = /^([a-z])(\d{2})(\d{4})$/;
// name, or first.last (letters; dots, hyphens, underscores or digits only between name parts)
const STAFF = /^[a-z]{2,}([._-][a-z]{2,})*\d{0,2}$/;

export const EMAIL_HELP = "Students: f223284@cfd.nu.edu.pk (letter, batch, roll no.). Teachers and staff: firstname.lastname@cfd.nu.edu.pk.";

export function checkUniEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, code: "empty", message: "Enter your university email address." };
  const at = email.split("@");
  if (at.length !== 2 || !at[0] || !at[1] || /\s/.test(email) || !at[1].includes(".")) {
    return { ok: false, code: "invalid", message: "That doesn't look like an email address. Example: f223284@cfd.nu.edu.pk" };
  }
  const [local, domain] = at;
  if (domain !== UNI_DOMAIN) {
    return { ok: false, code: "domain", message: `Use your university email ending in @${UNI_DOMAIN}. Other email providers can't be used.` };
  }
  const s = STUDENT.exec(local);
  if (s) {
    const [, campus, batch, roll] = s;
    return { ok: true, kind: "student", email, campus: campus.toUpperCase(), batch, roll, rollNo: `${batch}${campus.toUpperCase()}-${roll}` };
  }
  if (/^[a-z]\d+$/.test(local)) {
    return { ok: false, code: "local", message: "Student emails are one letter, then the 2-digit batch and 4-digit roll number, e.g. f223284@cfd.nu.edu.pk." };
  }
  if (STAFF.test(local)) return { ok: true, kind: "staff", email, handle: local };
  return { ok: false, code: "local", message: "Staff emails use the person's name, e.g. saaqib.ameer@cfd.nu.edu.pk (letters only, no spaces)." };
}

/** Student email for a roll number like "22F-3284" → "f223284@cfd.nu.edu.pk". */
export function emailForRoll(rollNo: string): string {
  const m = /^(\d{2})([A-Za-z])-(\d{4})$/.exec(rollNo.trim());
  return m ? `${m[2].toLowerCase()}${m[1]}${m[3]}@${UNI_DOMAIN}` : "";
}
