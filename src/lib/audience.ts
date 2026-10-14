import type { Audience, Role, User } from "@/types/api";

export const STUDENT_ROLES: Role[] = ["DAY_SCHOLAR", "HOSTELITE", "FACULTY"];
export const isStudentRole = (r: Role) => STUDENT_ROLES.includes(r);

/** Notification recipients. A notification without an audience goes to everybody. */
export const to = {
  admin: { roles: ["ADMIN"] } as Audience,
  /** One student's own information (plus the admin, who manages it). */
  student: (userId: string, alsoAdmin = false): Audience => ({ users: [userId], roles: alsoAdmin ? ["ADMIN"] : undefined }),
  /** Students riding a route (operational info about their own bus) + admin. */
  route: (routeId: string): Audience => ({ routeIds: [routeId], roles: ["ADMIN"] }),
  roles: (...roles: Role[]): Audience => ({ roles }),
  /** Announcements: everyone for "ALL", otherwise only that kind of student (and the admin who wrote it). */
  announcement: (audience: "ALL" | "HOSTELITE" | "DAY_SCHOLAR"): Audience | undefined =>
    audience === "ALL" ? undefined : { roles: [audience, "ADMIN"] },
};

/** True if `user` is allowed to see a notification with this audience. */
export function isVisibleTo(audience: Audience | undefined, user: Pick<User, "id" | "role" | "routeId"> | null): boolean {
  if (!audience) return true;
  if (!user) return false;
  if (audience.users?.includes(user.id)) return true;
  if (audience.roles?.includes(user.role)) return true;
  if (audience.routeIds && user.routeId && audience.routeIds.includes(user.routeId) && user.role !== "ADMIN") return true;
  return false;
}
