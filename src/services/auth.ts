import type { LoginRequest, LoginResponse, Student, User } from "@/types/api";
import { uid, useDemoDB } from "@/demo/db";
import { checkUniEmail } from "@/lib/email";
import { DEMO_MODE } from "./wsClient";
import { http, wait } from "./http";

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  /** Students only; teachers/staff are registered as faculty. */
  residence?: "DAY_SCHOLAR" | "HOSTELITE";
}

export const authService = {
  /** Sign in with a university email + password. The email format is checked before anything else. */
  async login(req: LoginRequest): Promise<LoginResponse> {
    const chk = checkUniEmail(req.email);
    if (!chk.ok) throw new Error(chk.message);
    if (!req.password) throw new Error("Enter your password.");
    if (!DEMO_MODE) return (await http.post<LoginResponse>("/auth/login", { email: chk.email, password: req.password })).data;
    await wait(150);
    const acct = useDemoDB.getState().accounts.find((a) => a.email?.toLowerCase() === chk.email);
    if (!acct || acct.password !== req.password) throw new Error("Incorrect email or password.");
    const { password: _pw, ...user } = acct;
    return { token: `demo-${user.id}`, user };
  },

  /** Create an account. Students use f223284@cfd.nu.edu.pk (roll number is read from it); teachers use firstname.lastname@. */
  async register(data: RegisterRequest): Promise<{ user: User }> {
    const chk = checkUniEmail(data.email);
    if (!chk.ok) throw new Error(chk.message);
    if (data.name.trim().length < 3) throw new Error("Enter your full name.");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!DEMO_MODE) return (await http.post<{ user: User }>("/auth/register", { ...data, email: chk.email })).data;
    await wait(200);
    const d = useDemoDB.getState();
    if (d.accounts.some((a) => a.email?.toLowerCase() === chk.email)) throw new Error("An account with this email already exists. Sign in instead.");
    const id = uid("U");
    const isStudent = chk.kind === "student";
    if (isStudent && d.students.some((s) => s.rollNo.toUpperCase() === chk.rollNo)) throw new Error(`Roll number ${chk.rollNo} is already registered.`);
    const residence = isStudent ? data.residence ?? "DAY_SCHOLAR" : "FACULTY";
    const route = d.routes[0];
    const user: User = { id, identifier: isStudent ? chk.rollNo : chk.handle, name: data.name.trim(), email: chk.email, role: residence, routeId: route?.id };
    const student: Student = { id, rollNo: isStudent ? chk.rollNo : chk.handle, name: user.name, email: chk.email, phone: "-", residence, routeId: route?.id ?? "", stopId: route?.stops[0]?.id, status: "ACTIVE" };
    d.patch((s) => ({ accounts: [...s.accounts, { ...user, password: data.password }], students: [student, ...s.students] }));
    return { user };
  },
};
