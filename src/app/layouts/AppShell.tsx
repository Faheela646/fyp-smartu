import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, MoreHorizontal, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Logo } from "@/components/domain/Logo";
import { ConnectionStatus } from "@/components/domain/ConnectionStatus";
import { OfflineBanner } from "@/components/domain/OfflineBanner";
import { NotificationBell } from "@/components/domain/NotificationBell";
import { ThemeToggle } from "@/components/domain/ThemeToggle";
import { ChatWidget } from "@/components/domain/ChatPanel";
import { NAV, PORTAL_LABEL, ROLE_LABEL, labelOf, type NavItem } from "@/app/nav";
import { useAuthStore } from "@/store/auth";
import { useQueryClient } from "@tanstack/react-query";
import { bookingService } from "@/services/bookings";
import { DEMO_MODE } from "@/services/wsClient";
import { cn } from "@/lib/utils";
import type { PortalKind } from "@/types/api";

const COLLAPSE_KEY = "smartu-sidebar-collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

function SideLink({ item, collapsed, onClick, role }: { item: NavItem; collapsed?: boolean; onClick?: () => void; role: import("@/types/api").Role }) {
  const label = labelOf(item, role);
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-md px-3.5 py-3 text-[15px] font-semibold transition-colors",
          collapsed && "justify-center px-0",
          isActive ? "bg-primary text-primary-foreground shadow-soft" : "text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground",
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
    </NavLink>
  );
}

export function AppShell({ portal }: { portal: PortalKind }) {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useCollapsed();
  const [drawer, setDrawer] = useState(false);
  const qc = useQueryClient();

  // Warm the other pages of this portal while the browser is idle, so navigating feels instant.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const id = idle(() => {
      const loaders: Record<string, (() => Promise<unknown>)[]> = {
        student: [() => import("@/pages/student/LiveMap"), () => import("@/pages/student/Book"), () => import("@/pages/student/MyQR"), () => import("@/pages/student/MyTickets"), () => import("@/pages/student/Payments")],
        conductor: [() => import("@/pages/conductor/Passengers"), () => import("@/pages/conductor/Manual"), () => import("@/pages/conductor/Report")],
        admin: [() => import("@/pages/admin/Students"), () => import("@/pages/admin/FinesBans"), () => import("@/pages/admin/FeeApprovals"), () => import("@/pages/admin/RoutesPage"), () => import("@/pages/admin/Tracking")],
      };
      loaders[portal]?.forEach((load) => void load().catch(() => undefined));
    });
    return () => (window as unknown as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(id as number);
  }, [portal]);

  // Tickets are disposed automatically once their time is up (default 14 h after the trip starts).
  useEffect(() => {
    if (portal !== "student" || !DEMO_MODE) return;
    const t = setInterval(() => { if (bookingService.sweep() > 0) qc.invalidateQueries({ queryKey: ["bookings"] }); }, 30_000);
    return () => clearInterval(t);
  }, [portal, qc]);

  const items = useMemo(() => NAV[portal].filter((i) => !i.roles || i.roles.includes(user.role)), [portal, user.role]);
  const bottom = items.filter((i) => i.primary);
  const hasBottomNav = portal !== "admin";
  const current = [...items].reverse().find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));
  const notificationsHref = `/${portal}/notifications`;

  useEffect(() => setDrawer(false), [location.pathname]);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-[84px]" : "w-[288px]",
        )}
      >
        <div className={cn("flex items-center justify-center border-b border-sidebar-border p-4", collapsed && "px-2")}>
          {collapsed ? <Logo variant="mark" className="w-[60px]" /> : <Logo className="max-w-[200px]" />}
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {items.map((i) => (
            <SideLink key={i.to} item={i} collapsed={collapsed} role={user.role} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <Button variant="ghost" size="md" className={cn("w-full text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground", collapsed ? "px-0" : "justify-start")} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="sticky top-0 z-[1100] flex h-[76px] items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:gap-3 sm:px-8 xl:px-10">
          {!hasBottomNav && (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="lg:hidden">
            <Logo variant="mark" className="w-12" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="hidden truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:block">{PORTAL_LABEL[portal]}</p>
            <h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">{current ? labelOf(current, user.role) : "SmartU"}</h1>
          </div>
          <ConnectionStatus />
          <ThemeToggle />
          <NotificationBell allHref={notificationsHref} />
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="ghost" className="h-12 gap-2.5 px-2" aria-label="Account menu">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <span className="hidden text-left leading-tight md:block">
                  <span className="block text-sm font-semibold">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
                </span>
              </Button>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>{user.identifier}</DropdownLabel>
              {portal === "student" && (
                <DropdownItem onSelect={() => navigate("/student/profile")}>
                  <UserCircle className="h-4 w-4" /> Profile
                </DropdownItem>
              )}
              <DropdownSeparator />
              <DropdownItem onSelect={signOut} className="text-danger">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        </header>

        <main id="main" className={cn("flex-1 px-4 py-6 sm:px-8 xl:px-10 sm:py-8", hasBottomNav && "pb-28 lg:pb-8")}>
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="w-full">
            <Outlet />
          </motion.div>
        </main>
      </div>

      {portal === "student" && <ChatWidget />}

      {/* Mobile bottom navigation */}
      {hasBottomNav && (
        <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-[1100] border-t border-border bg-surface/95 backdrop-blur lg:hidden">
          <ul className="mx-auto flex max-w-md items-stretch justify-around">
            {bottom.map((i) => (
              <li key={i.to} className="flex-1">
                <NavLink
                  to={i.to}
                  end={i.end}
                  className={({ isActive }) =>
                    cn("flex flex-col items-center gap-1 px-1 py-2.5 text-xs font-semibold", isActive ? "text-primary" : "text-muted-foreground")
                  }
                >
                  <i.icon className="h-6 w-6" aria-hidden />
                  {labelOf(i, user.role)}
                </NavLink>
              </li>
            ))}
            {items.length > bottom.length && (
              <li className="flex-1">
                <button onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-xs font-semibold text-muted-foreground">
                  <MoreHorizontal className="h-6 w-6" aria-hidden />
                  More
                </button>
              </li>
            )}
          </ul>
        </nav>
      )}

      {/* Drawer: admin menu on mobile, "More" for the other roles */}
      <Modal open={drawer} onOpenChange={setDrawer} title="Menu" variant={hasBottomNav ? "bottom" : "left"}>
        <nav aria-label="All pages" className={cn("space-y-1 rounded-lg bg-sidebar p-2", hasBottomNav && "grid grid-cols-2 gap-1 space-y-0")}>
          {(hasBottomNav ? items.filter((i) => !i.primary) : items).map((i) => (
            <SideLink key={i.to} item={i} onClick={() => setDrawer(false)} role={user.role} />
          ))}
        </nav>
      </Modal>
    </div>
  );
}
