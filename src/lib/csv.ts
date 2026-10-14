import type { Residence } from "@/types/api";

export interface StudentInput {
  name: string;
  rollNo: string;
  email: string;
  phone: string;
  residence: Residence;
  routeId: string;
}
export interface ParsedRow {
  line: number;
  data?: StudentInput;
  error?: string;
}

export const STUDENT_CSV_HEADER = "name,rollNo,email,phone,type,routeId";
export const STUDENT_CSV_TEMPLATE = `${STUDENT_CSV_HEADER}\nAyesha Noor,24F-3101,f243101@cfd.nu.edu.pk,0300-1234567,day,R01\nHassan Raza,24F-3102,f243102@cfd.nu.edu.pk,0301-7654321,hostelite,R05\n`;

/** Minimal CSV line splitter with quote support. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === "," && !q) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const ROLL = /^\d{2}[A-Za-z]-\d{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseStudentsCsv(text: string, validRoutes: string[]): ParsedRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const hasHeader = /^name\s*,/i.test(lines[0]);
  const rows = hasHeader ? lines.slice(1) : lines;
  const seen = new Set<string>();
  return rows.map((l, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const [name = "", rollNo = "", email = "", phone = "", type = "", routeId = ""] = splitLine(l);
    const t = type.toLowerCase();
    const residence: Residence | null = t.startsWith("host") ? "HOSTELITE" : t.startsWith("day") ? "DAY_SCHOLAR" : t.startsWith("fac") ? "FACULTY" : null;
    const problems: string[] = [];
    if (name.length < 3) problems.push("name too short");
    if (!ROLL.test(rollNo)) problems.push("roll no. must look like 24F-3101");
    if (!EMAIL.test(email)) problems.push("invalid email");
    if (phone.length < 7) problems.push("invalid phone");
    if (!residence) problems.push("type must be day / hostelite / faculty");
    if (!validRoutes.includes(routeId)) problems.push(`unknown route "${routeId}"`);
    if (ROLL.test(rollNo) && seen.has(rollNo.toUpperCase())) problems.push("duplicate roll no. in file");
    seen.add(rollNo.toUpperCase());
    if (problems.length) return { line, error: problems.join("; ") };
    return { line, data: { name, rollNo: rollNo.toUpperCase(), email, phone, residence: residence!, routeId } };
  });
}
