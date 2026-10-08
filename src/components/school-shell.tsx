import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Banknote,
  School,
  ScrollText,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import headTeacher from "@/assets/head-teacher.jpg";
import { neonAuthClient } from "../auth/client";
import { useTenantBranding } from "./tenant-branding-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Students", to: "/students", icon: GraduationCap },
  { label: "Payments", to: "/payments", icon: ReceiptText },
  { label: "Grades", to: "/grades", icon: ScrollText },
  { label: "Teachers", to: "/teachers", icon: UsersRound },
  { label: "Classes", to: "/classes", icon: School },
  { label: "Coupons", to: "/coupons", icon: TicketCheck },
] as const;

const platformNavigation = [
  { label: "School directory", to: "/admin", icon: Building2 },
] as const;

const schoolAdminNavigation = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Students", to: "/students", icon: GraduationCap },
  { label: "Payments", to: "/payments", icon: ReceiptText },
  { label: "Attendance", to: "/attendance-overview", icon: UserRoundCheck },
  { label: "Grades", to: "/grades", icon: ScrollText },
  { label: "Terminal reports", to: "/terminal-reports", icon: ScrollText },
  { label: "Academic setup", to: "/academic-setup", icon: CalendarDays },
  { label: "Teachers", to: "/teachers", icon: UsersRound },
  { label: "Classes", to: "/classes", icon: School },
  { label: "Coupons", to: "/coupons", icon: TicketCheck },
  { label: "School administration", to: "/school-admin", icon: School },
] as const;

const parentNavigation = [
  { label: "My children", to: "/parent", icon: GraduationCap },
] as const;

const studentNavigation = [
  { label: "My learning", to: "/student", icon: GraduationCap },
] as const;

const financeNavigation = [
  { label: "Finance desk", to: "/finance", icon: LayoutDashboard },
  { label: "Daily payments", to: "/daily-payments", icon: Banknote },
] as const;


function Sidebar({ onNavigate, schoolName, crestUrl, platform = false, schoolAdmin = false, parentPortal = false, studentPortal = false, finance = false }: { onNavigate?: () => void; schoolName: string; crestUrl: string | null; platform?: boolean; schoolAdmin?: boolean; parentPortal?: boolean; studentPortal?: boolean; finance?: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const links = platform ? platformNavigation : schoolAdmin ? schoolAdminNavigation : parentPortal ? parentNavigation : studentPortal ? studentNavigation : finance ? financeNavigation : navigation;

  return (
    <aside className="sidebar-gloss flex h-dvh w-60 shrink-0 flex-col overflow-hidden px-3 py-5 text-primary-foreground">
      <div className="flex shrink-0 items-center gap-2.5 px-2 py-1.5">
        <div className="grid size-9 place-items-center overflow-hidden rounded-md bg-highlight font-display text-base font-bold text-highlight-foreground shadow-sm">
          {platform ? <ShieldCheck className="size-4" /> : crestUrl ? <img src={crestUrl} alt={`${schoolName} crest`} className="size-full object-cover" /> : (schoolName[0] ?? "S")}
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold">{platform ? "Klasora" : schoolName}</p>
          <p className="text-[11px] text-primary-foreground/50">{platform ? "Klasora Platform" : schoolAdmin ? "School Admin Console" : parentPortal ? "Family Portal" : studentPortal ? "Student Portal" : finance ? "Finance Workspace" : "School Operations"}</p>
        </div>
      </div>
      <p className="shrink-0 px-3 pb-1 pt-5 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/35">
        {platform ? "Platform" : "Workspace"}
      </p>
      <nav aria-label="Main navigation" tabIndex={0} className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-1 outline-none focus-visible:ring-1 focus-visible:ring-highlight/50">
        <div className="flex flex-col gap-0.5">
        {links.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-highlight/20 text-primary-foreground ring-1 ring-highlight/30"
                  : "text-primary-foreground/65 hover:bg-primary-foreground/10 hover:text-primary-foreground",
              )}
            >
              <Icon className={cn("size-4", active ? "text-highlight" : "text-primary-foreground/40")} />
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>
      <div className="mt-4 shrink-0 rounded-md bg-primary-foreground/5 px-2 py-3 ring-1 ring-primary-foreground/10">
        <div className="flex items-center gap-2.5">
          {platform ? <div className="grid size-9 place-items-center rounded-md bg-highlight/20 text-highlight"><ShieldCheck className="size-4" /></div> : <img src={headTeacher} alt="Dr. Adaeze Okafor" width={512} height={512} loading="lazy" className="size-9 rounded-md object-cover ring-1 ring-primary-foreground/15" />}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{platform ? "Akwasi Julian" : schoolAdmin ? "School Administrator" : parentPortal ? "Mrs. Mensah" : studentPortal ? "Ama Mensah" : finance ? "Finance Officer" : "Dr. Adaeze Okafor"}</p>
            <p className="text-[11px] text-primary-foreground/45">{platform ? "Super Admin" : schoolAdmin ? "School Admin" : parentPortal ? "Parent" : studentPortal ? "Form 1A Student" : finance ? "Finance" : "Head Teacher"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            sessionStorage.removeItem("hg-role");
            sessionStorage.removeItem("hg-school");
            if (platform) await fetch("/api/platform/session", { method: "DELETE" });
            await fetch("/api/auth/session", { method: "DELETE" });
            await neonAuthClient?.signOut().catch(() => undefined);
            onNavigate?.();
            navigate({ to: platform ? "/" : "/login" });
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <LogOut className="size-3.5" />Sign out
        </button>
      </div>
    </aside>
  );
}

export function SchoolShell({ children, title = "Overview", platform = false, schoolAdmin = false, parentPortal = false, studentPortal = false, finance = false }: { children: ReactNode; title?: string; platform?: boolean; schoolAdmin?: boolean; schoolAdminOrTeacher?: boolean; parentPortal?: boolean; studentPortal?: boolean; finance?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminView, setAdminView] = useState(schoolAdmin);
  const navigate = useNavigate();
  const { schoolName, crestUrl } = useTenantBranding();

  useEffect(() => {
    const role = sessionStorage.getItem("hg-role");
    setAdminView(role ? role === "school_admin" : schoolAdmin);
  }, [schoolAdmin]);

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="fixed inset-y-0 left-0 z-40 hidden h-dvh lg:block">
        <Sidebar schoolName={schoolName} crestUrl={crestUrl} platform={platform} schoolAdmin={adminView} parentPortal={parentPortal} studentPortal={studentPortal} finance={finance} />
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="relative z-10 h-full"><Sidebar schoolName={schoolName} crestUrl={crestUrl} platform={platform} schoolAdmin={adminView} parentPortal={parentPortal} studentPortal={studentPortal} finance={finance} onNavigate={() => setMenuOpen(false)} /></div>
          <button aria-label="Close navigation" className="absolute inset-0 bg-foreground/25" onClick={() => setMenuOpen(false)} />
        </div>
      ) : null}
      <div className="relative min-w-0 flex-1 lg:ml-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <div className="hidden h-8 w-px bg-primary/10 sm:block" />
            <div>
              <p className="text-xs text-muted-foreground">Tuesday, 14 May 2024</p>
              <p className="text-sm font-medium text-secondary-foreground">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Term II · Week 9</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                sessionStorage.removeItem("hg-role");
                sessionStorage.removeItem("hg-school");
                if (platform) await fetch("/api/platform/session", { method: "DELETE" });
                await neonAuthClient?.signOut().catch(() => undefined);
                navigate({ to: platform ? "/" : "/login" });
              }}
            >
              <LogOut />Sign out
            </Button>
            <Button size="sm">{platform ? "Add school" : adminView ? "Add user" : parentPortal ? "Pay fees" : studentPortal ? "View results" : "New entry"}</Button>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
