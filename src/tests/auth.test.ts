import { describe, expect, it } from "vitest";
import { checkUniEmail, emailForRoll } from "@/lib/email";
import { authService } from "@/services/auth";
import { db } from "./helpers";

describe("AUTH: university email rules", () => {
  it.each([
    ["f223284@cfd.nu.edu.pk", "22F-3284"],
    ["i221234@cfd.nu.edu.pk", "22I-1234"],
    ["k231050@cfd.nu.edu.pk", "23K-1050"],
    ["m245678@cfd.nu.edu.pk", "24M-5678"],
    ["l219999@cfd.nu.edu.pk", "21L-9999"],
    ["  F223284@CFD.NU.EDU.PK ", "22F-3284"], // case and spaces are forgiven
  ])("student email %s → roll number %s", (email, roll) => {
    const r = checkUniEmail(email);
    expect(r).toMatchObject({ ok: true, kind: "student", rollNo: roll });
  });

  it("reads batch, campus letter and roll from the address", () => {
    expect(checkUniEmail("f223284@cfd.nu.edu.pk")).toMatchObject({ campus: "F", batch: "22", roll: "3284", email: "f223284@cfd.nu.edu.pk" });
  });

  it.each(["saaqib.ameer@cfd.nu.edu.pk", "rashid.mehmood@cfd.nu.edu.pk", "transport.office@cfd.nu.edu.pk", "waqas@cfd.nu.edu.pk", "ayesha_khan@cfd.nu.edu.pk"])("staff / teacher / conductor email %s is accepted", (email) => {
    expect(checkUniEmail(email)).toMatchObject({ ok: true, kind: "staff" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["not-an-email", "invalid"],
    ["f223284@", "invalid"],
    ["@cfd.nu.edu.pk", "invalid"],
    ["f223284 @cfd.nu.edu.pk", "invalid"],
    ["f223284@gmail.com", "domain"],
    ["f223284@nu.edu.pk", "domain"],
    ["f223284@cfd.nu.edu.pk.evil.com", "domain"],
    ["f22328@cfd.nu.edu.pk", "local"], // roll number too short
    ["f2232845@cfd.nu.edu.pk", "local"], // too long
    ["223284@cfd.nu.edu.pk", "local"], // no campus letter
    ["fx23284@cfd.nu.edu.pk", "local"],
    ["a.b@cfd.nu.edu.pk", "local"], // name parts too short
    ["saaqib ameer@cfd.nu.edu.pk", "invalid"],
  ])("rejects %j (%s)", (email, code) => {
    const r = checkUniEmail(email);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe(code);
      expect(r.message.length).toBeGreaterThan(10); // a human-readable error is always given
    }
  });

  it("error messages tell the user what to fix", () => {
    const wrongDomain = checkUniEmail("f223284@gmail.com");
    expect(!wrongDomain.ok && wrongDomain.message).toMatch(/@cfd\.nu\.edu\.pk/);
    const badStudent = checkUniEmail("f22328@cfd.nu.edu.pk");
    expect(!badStudent.ok && badStudent.message).toMatch(/4-digit roll number/);
  });

  it("builds the student email from a roll number", () => {
    expect(emailForRoll("22F-3284")).toBe("f223284@cfd.nu.edu.pk");
    expect(emailForRoll("bad")).toBe("");
  });

  it("every seeded student's email follows the student rule and matches their roll number", () => {
    db().students.forEach((s) => {
      const r = checkUniEmail(s.email);
      expect(r, s.email).toMatchObject({ ok: true, kind: "student", rollNo: s.rollNo });
    });
  });
});

describe("AUTH: sign in", () => {
  it("accepts the demo accounts by university email", async () => {
    expect((await authService.login({ email: "f223091@cfd.nu.edu.pk", password: "3091@fast" })).user).toMatchObject({ name: "Hamza Ali", role: "HOSTELITE", identifier: "22F-3091" });
    expect((await authService.login({ email: "f223082@cfd.nu.edu.pk", password: "3082@fast" })).user.role).toBe("DAY_SCHOLAR");
    expect((await authService.login({ email: "rashid.mehmood@cfd.nu.edu.pk", password: "conductor123" })).user.role).toBe("CONDUCTOR");
    expect((await authService.login({ email: "transport.office@cfd.nu.edu.pk", password: "admin123" })).user.role).toBe("ADMIN");
  });
  it("email is case-insensitive and trimmed", async () => {
    expect((await authService.login({ email: "  F223091@CFD.NU.EDU.PK ", password: "3091@fast" })).user.id).toBe("U-3091");
  });
  it("wrong password and unknown account give the same message (no account probing)", async () => {
    await expect(authService.login({ email: "f223091@cfd.nu.edu.pk", password: "nope" })).rejects.toThrow("Incorrect email or password.");
    await expect(authService.login({ email: "f229999@cfd.nu.edu.pk", password: "3091@fast" })).rejects.toThrow("Incorrect email or password.");
  });
  it("the old roll-number / username login no longer works", async () => {
    await expect(authService.login({ email: "22F-3091", password: "3091@fast" })).rejects.toThrow(/valid email|email address/i);
    await expect(authService.login({ email: "admin", password: "admin123" })).rejects.toThrow(/valid email|email address/i);
  });
  it("other email domains are refused before the password is even checked", async () => {
    await expect(authService.login({ email: "f223091@gmail.com", password: "3091@fast" })).rejects.toThrow(/@cfd\.nu\.edu\.pk/);
  });
  it("requires a password", async () => {
    await expect(authService.login({ email: "f223091@cfd.nu.edu.pk", password: "" })).rejects.toThrow(/password/i);
  });
});

describe("AUTH: sign up", () => {
  it("a student registers with their university email: roll number comes from the address, then they can sign in", async () => {
    const { user } = await authService.register({ name: "Zoya Malik", email: "k231234@cfd.nu.edu.pk", password: "longenough1", residence: "HOSTELITE" });
    expect(user).toMatchObject({ identifier: "23K-1234", role: "HOSTELITE", email: "k231234@cfd.nu.edu.pk" });
    expect(db().students.find((s) => s.rollNo === "23K-1234")).toMatchObject({ name: "Zoya Malik", residence: "HOSTELITE", email: "k231234@cfd.nu.edu.pk" });
    expect((await authService.login({ email: "k231234@cfd.nu.edu.pk", password: "longenough1" })).user.name).toBe("Zoya Malik");
  });
  it("a teacher registers with firstname.lastname@ and becomes faculty", async () => {
    const { user } = await authService.register({ name: "Saaqib Ameer", email: "saaqib.ameer@cfd.nu.edu.pk", password: "longenough1" });
    expect(user).toMatchObject({ role: "FACULTY", identifier: "saaqib.ameer" });
  });
  it("refuses a duplicate email, a duplicate roll number, a bad domain, a bad format, a weak password and a missing name", async () => {
    await expect(authService.register({ name: "Someone Else", email: "f223091@cfd.nu.edu.pk", password: "longenough1" })).rejects.toThrow(/already exists/);
    await expect(authService.register({ name: "Someone Else", email: "f223082@cfd.nu.edu.pk", password: "longenough1" })).rejects.toThrow(/already exists/);
    await expect(authService.register({ name: "Someone Else", email: "z999999@gmail.com", password: "longenough1" })).rejects.toThrow(/@cfd\.nu\.edu\.pk/);
    await expect(authService.register({ name: "Someone Else", email: "f12345@cfd.nu.edu.pk", password: "longenough1" })).rejects.toThrow(/roll number/);
    await expect(authService.register({ name: "Someone Else", email: "i221111@cfd.nu.edu.pk", password: "short" })).rejects.toThrow(/8 characters/);
    await expect(authService.register({ name: "ab", email: "i221111@cfd.nu.edu.pk", password: "longenough1" })).rejects.toThrow(/full name/);
  });
  it("a roll number that already exists under a different email is refused", async () => {
    db().patch((d) => ({ students: [{ ...d.students[0], id: "U-X", rollNo: "22I-4444", email: "other@cfd.nu.edu.pk" }, ...d.students] }));
    await expect(authService.register({ name: "Another Person", email: "i224444@cfd.nu.edu.pk", password: "longenough1" })).rejects.toThrow(/already registered/);
  });
});
