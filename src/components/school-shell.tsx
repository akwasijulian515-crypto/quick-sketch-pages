import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Banknote,
  School,
  ScrollText,
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
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, group: "Core" },
  { label: "Students", to: "/students", icon: GraduationCap, group: "Academics" },
  { label: "Grades", to: "/grades", icon: ScrollText, group: "Academics" },
  { label: "Classes", to: "/classes", icon: School, group: "Academics" },
  { label: "Teachers", to: "/teachers", icon: UsersRound, group: "Academics" },
  { label: "Payments", to: "/payments", icon: ReceiptText, group: "Finance" },
  { label: "Daily payments", to: "/daily-payments", icon: Banknote, group: "Finance" },
] as const;

const platformNavigation = [
  { label: "School directory", to: "/admin", icon: Building2, group: "Platform" },
] as const;

const schoolAdminNavigation = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, group: "Core" },
  { label: "Students", to: "/students", icon: GraduationCap, group: "Academics" },
  { label: "Attendance", to: "/attendance-overview", icon: UserRoundCheck, group: "Academics" },
  { label: "Grades", to: "/grades", icon: ScrollText, group: "Academics" },
  { label: "Terminal reports", to: "/terminal-reports", icon: ScrollText, group: "Academics" },
  { label: "Classes", to: "/classes", icon: School, group: "Academics" },
  { label: "Teachers", to: "/teachers", icon: UsersRound, group: "Academics" },
  { label: "Academic setup", to: "/academic-setup", icon: CalendarDays, group: "Academics" },
  { label: "Payments", to: "/payments", icon: ReceiptText, group: "Finance" },
  { label: "Daily payments", to: "/daily-payments", icon: Banknote, group: "Finance" },
  { label: "Financial records", to: "/student-finances", icon: FileText, group: "Finance" },
  { label: "Daily reconciliation", to: "/reconciliation", icon: ShieldCheck, group: "Finance" },
  { label: "School administration", to: "/school-admin", icon: School, group: "Administration" },
] as const;

const parentNavigation = [
  { label: "My children", to: "/parent", icon: GraduationCap, group: "Family" },
] as const;

const studentNavigation = [
  { label: "My learning", to: "/student", icon: GraduationCap, group: "Learning" },
] as const;

const financeNavigation = [
  { label: "Finance desk", to: "/finance", icon: LayoutDashboard, group: "Core" },
  { label: "Daily payments", to: "/daily-payments", icon: Banknote, group: "Finance" },
  { label: "Daily reconciliation", to: "/reconciliation", icon: ShieldCheck, group: "Finance" },
] as const;

function prepareSignedOutContext(platform: boolean, subdomain: string) {
  sessionStorage.removeItem("hg-role");
  if (platform) {
    sessionStorage.removeItem("hg-school");
    return;
  }

  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ??
    (subdomain !== "school" ? subdomain : null);
  if (tenant) sessionStorage.setItem("hg-school", tenant);
  else sessionStorage.removeItem("hg-school");
}

function Sidebar({
  onNavigate,
  schoolName,
  subdomain,
  crestUrl,
  platform = false,
  schoolAdmin = false,
  parentPortal = false,
  studentPortal = false,
  finance = false,
}: {
  onNavigate?: () => void;
  schoolName: string;
  subdomain: string;
  crestUrl: string | null;
  platform?: boolean;
  schoolAdmin?: boolean;
  parentPortal?: boolean;
  studentPortal?: boolean;
  finance?: boolean;
}) {
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const viewingSubjects =
    pathname === "/teachers" && "view" in location.search && location.search["view"] === "subjects";
  const navigate = useNavigate();
  const links = platform
    ? platformNavigation
    : schoolAdmin
      ? schoolAdminNavigation
      : parentPortal
        ? parentNavigation
        : studentPortal
          ? studentNavigation
          : finance
            ? financeNavigation
            : navigation;

  return (
    <aside className="sidebar-gloss flex h-dvh w-60 shrink-0 flex-col overflow-hidden px-3 py-5 text-primary-foreground">
      <div className="flex shrink-0 items-center gap-2.5 px-2 py-1.5">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-highlight font-display text-base font-bold text-highlight-foreground shadow-sm">
          {platform ? (
            <img src="/brand/klasora-icon.png" alt="" className="size-full object-contain" />
          ) : crestUrl ? (
            <img src={crestUrl} alt={`${schoolName} crest`} className="size-full object-cover" />
          ) : (
            (schoolName[0] ?? "S")
          )}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-bold">
            {platform ? "Klasora" : schoolName}
          </p>
          <p className="text-[11px] text-primary-foreground/50">
            {platform
              ? "Klasora Platform"
              : schoolAdmin
                ? "School Admin Console"
                : parentPortal
                  ? "Family Portal"
                  : studentPortal
                    ? "Student Portal"
                    : finance
                      ? "Finance Workspace"
                      : "School Operations"}
          </p>
        </div>
      </div>
      <nav
        aria-label="Main navigation"
        tabIndex={0}
        className="sidebar-scroll mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-1 outline-none focus-visible:ring-1 focus-visible:ring-highlight/50"
      >
        <div className="flex flex-col gap-0.5">
          {links.map((item, index) => {
            const active = pathname === item.to && !(item.to === "/teachers" && viewingSubjects);
            const Icon = item.icon;
            const showGroup = index === 0 || links[index - 1]?.group !== item.group;
            return (
              <div key={item.to} className="contents">
                {showGroup ? (
                  <p
                    className={cn(
                      "px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/35",
                      index === 0 ? "pt-1" : "pt-4",
                    )}
                  >
                    {item.group}
                  </p>
                ) : null}
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-highlight/70",
                    active
                      ? "bg-highlight/20 text-primary-foreground ring-1 ring-highlight/30"
                      : "text-primary-foreground/65 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-highlight" : "text-primary-foreground/40",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {active ? (
                    <span
                      aria-hidden
                      className="ml-auto size-1.5 shrink-0 rounded-full bg-highlight"
                    />
                  ) : null}
                </Link>
              </div>
            );
          })}
        </div>
      </nav>
      <div className="mt-4 shrink-0 rounded-md bg-primary-foreground/5 px-2 py-3 ring-1 ring-primary-foreground/10">
        <div className="flex items-center gap-2.5">
          {platform ? (
            <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-highlight/20">
              <img src="/brand/klasora-icon.png" alt="" className="size-full object-contain" />
            </div>
          ) : (
            <img
              src={headTeacher}
              alt="Dr. Adaeze Okafor"
              width={512}
              height={512}
              loading="lazy"
              className="size-9 rounded-md object-cover ring-1 ring-primary-foreground/15"
            />
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">
              {platform
                ? "Akwasi Julian"
                : schoolAdmin
                  ? "School Administrator"
                  : parentPortal
                    ? "Mrs. Mensah"
                    : studentPortal
                      ? "Ama Mensah"
                      : finance
                        ? "Finance Officer"
                        : "Dr. Adaeze Okafor"}
            </p>
            <p className="text-[11px] text-primary-foreground/45">
              {platform
                ? "Super Admin"
                : schoolAdmin
                  ? "School Admin"
                  : parentPortal
                    ? "Parent"
                    : studentPortal
                      ? "Form 1A Student"
                      : finance
                        ? "Finance"
                        : "Head Teacher"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            prepareSignedOutContext(platform, subdomain);
            if (platform) await fetch("/api/platform/session", { method: "DELETE" });
            await fetch("/api/auth/session", { method: "DELETE" });
            await neonAuthClient?.signOut().catch(() => undefined);
            onNavigate?.();
            navigate({ to: platform ? "/" : "/login" });
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function SchoolShell({
  children,
  title = "Overview",
  platform = false,
  schoolAdmin = false,
  schoolAdminOrTeacher = false,
  teacherPortal = false,
  parentPortal = false,
  studentPortal = false,
  finance = false,
}: {
  children: ReactNode;
  title?: string;
  platform?: boolean;
  schoolAdmin?: boolean;
  schoolAdminOrTeacher?: boolean;
  teacherPortal?: boolean;
  parentPortal?: boolean;
  studentPortal?: boolean;
  finance?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminView, setAdminView] = useState(schoolAdmin);
  const navigate = useNavigate();
  const { schoolName, subdomain, crestUrl } = useTenantBranding();

  useEffect(() => {
    // Copy table header text onto cells so phones can show tables as labelled cards.
    const label = () => {
      document.querySelectorAll(".mobile-cards table").forEach((table) => {
        const heads = Array.from(table.querySelectorAll("thead th")).map(
          (th) => th.textContent?.trim() ?? "",
        );
        table.querySelectorAll("tbody tr").forEach((tr) => {
          Array.from(tr.children).forEach((td, i) => {
            if (heads[i] && td.getAttribute("data-label") !== heads[i])
              td.setAttribute("data-label", heads[i]);
          });
        });
      });
    };
    label();
    const observer = new MutationObserver(label);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const role = sessionStorage.getItem("hg-role");
    setAdminView(schoolAdminOrTeacher ? schoolAdmin : role ? role === "school_admin" : schoolAdmin);
  }, [schoolAdmin, schoolAdminOrTeacher]);

  if (teacherPortal) {
    return (
      <div className="relative min-h-screen bg-background font-body text-foreground">
        <div className="pointer-events-none fixed inset-0 ambient-wash" />
        <header className="sticky top-0 z-30 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/75 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 place-items-center overflow-hidden rounded-md bg-primary font-display text-base font-bold text-primary-foreground">
              {crestUrl ? (
                <img
                  src={crestUrl}
                  alt={`${schoolName} crest`}
                  className="size-full object-cover"
                />
              ) : (
                (schoolName[0] ?? "S")
              )}
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold">Teacher Portal</p>
              <p className="text-[11px] text-muted-foreground">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="outline">
              <Link to="/teacher">
                <span className="sm:hidden">Back</span>
                <span className="hidden sm:inline">Back to teacher workspace</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                prepareSignedOutContext(false, subdomain);
                await fetch("/api/auth/session", { method: "DELETE" });
                await neonAuthClient?.signOut().catch(() => undefined);
                navigate({ to: "/login" });
              }}
              aria-label="Sign out"
            >
              <LogOut />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>
        <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="fixed inset-y-0 left-0 z-40 hidden h-dvh lg:block">
        <Sidebar
          schoolName={schoolName}
          subdomain={subdomain}
          crestUrl={crestUrl}
          platform={platform}
          schoolAdmin={adminView}
          parentPortal={parentPortal}
          studentPortal={studentPortal}
          finance={finance}
        />
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="relative z-10 h-full max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-300">
            <Sidebar
              schoolName={schoolName}
              subdomain={subdomain}
              crestUrl={crestUrl}
              platform={platform}
              schoolAdmin={adminView}
              parentPortal={parentPortal}
              studentPortal={studentPortal}
              finance={finance}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setMenuOpen(false)}
          />
        </div>
      ) : null}
      <div className="relative min-w-0 flex-1 lg:ml-60">
        <header className="sticky top-0 z-30 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/75 px-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <div className="hidden h-8 w-px bg-primary/10 sm:block" />
            <div className="min-w-0">
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Tuesday, 14 May 2024
              </p>
              <p className="truncate text-sm font-medium text-secondary-foreground">{title}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">Term II · Week 9</span>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="max-[420px]:size-9 max-[420px]:px-0"
              aria-label="Sign out"
              onClick={async () => {
                prepareSignedOutContext(platform, subdomain);
                if (platform) await fetch("/api/platform/session", { method: "DELETE" });
                await fetch("/api/auth/session", { method: "DELETE" });
                await neonAuthClient?.signOut().catch(() => undefined);
                navigate({ to: platform ? "/" : "/login" });
              }}
            >
              <LogOut />
              <span className="max-[420px]:sr-only">Sign out</span>
            </Button>
            <Button size="sm" className="hidden sm:inline-flex">
              {platform
                ? "Add school"
                : adminView
                  ? "Add user"
                  : parentPortal
                    ? "Pay fees"
                    : studentPortal
                      ? "View results"
                      : "New entry"}
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
