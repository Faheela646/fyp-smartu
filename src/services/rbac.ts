import type { Role, User } from "@/types/api";
import { useAuthStore } from "@/store/auth";
import { isStudentRole } from "@/lib/audience";

/**
 * Role-based access control for the demo (in-browser) backend.
 * With a real backend the server enforces the same rules; these guards make the demo behave identically
 * and stop one role from reading or changing another role's data even if the UI is bypassed.
 */
export class Forbidden extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "Forbidden";
  }
}

export function currentUser(): User {
  const u = useAuthStore.getState().user;
  if (!u) throw new Forbidden("Please sign in first.");
  return u;
}

export function requireRole(...roles: Role[]): User {
  const u = currentUser();
  if (!roles.includes(u.role)) throw new Forbidden();
  return u;
}

/** Students (any kind). */
export function requireStudent(): User {
  const u = currentUser();
  if (!isStudentRole(u.role)) throw new Forbidden();
  return u;
}

/**
 * Scope a read to the signed-in user: privileged roles may ask for anyone (or everyone, when `requested` is undefined),
 * everyone else only gets their own data and asking for someone else's is refused.
 */
export function scopeUserId(requested: string | undefined, ...privileged: Role[]): string | undefined {
  const u = currentUser();
  if (privileged.includes(u.role)) return requested;
  if (!isStudentRole(u.role)) throw new Forbidden(); // e.g. a conductor has no business here at all
  if (requested && requested !== u.id) throw new Forbidden("You can only see your own information.");
  return u.id;
}

/** Same as scopeUserId but for a record id the caller wants to act on. */
export function assertOwnerOr(ownerId: string, ...privileged: Role[]) {
  const u = currentUser();
  if (privileged.includes(u.role)) return u;
  if (ownerId !== u.id) throw new Forbidden("That record belongs to someone else.");
  return u;
}
