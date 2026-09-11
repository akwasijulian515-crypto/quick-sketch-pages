import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Menu,
  ReceiptText,
  School,
  ScrollText,
  ShieldCheck,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import headTeacher from "@/assets/head-teacher.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Students", to: "/students", icon: GraduationCap },
  { label: "Payments", to: "/payments", icon: ReceiptText },
  { label: "Attendance", to: "/attendance", icon: UserRoundCheck },
  { label: "Grades", to: "/grades", icon: ScrollText },
  { label: "Teachers", to: "/teachers", icon: UsersRound },
  { label: "Subjects", to: "/subjects", icon: BookOpen },
  { label: "Classes", to: "/classes", icon: School },
  { label: "Coupons", to: "/coupons", icon: TicketCheck },
] as const;

const roleViews = [
  { label: "Student view", to: "/student", icon: GraduationCap },
  { label: "Teacher view", to: "/teacher", icon: UserRoundCheck },
  { label: "Parent view", to: "/parent", icon: HeartHandshake },
  { label: "Finance view", to: "/finance", icon: Wallet },
  { label: "Admin & Roles", to: "/admin", icon: ShieldCheck },
] as const;

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-primary px-3 py-5 text-primary-foreground shadow-2xl shadow-primary/15">
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div className="grid size-9 place-items-center rounded-md bg-highlight font-display text-base font-bold text-highlight-foreground shadow-sm">
          H
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold">Harrow Green</p>
          <p className="text-[11px] text-primary-foreground/50">School Operations</p>
        </div>
      </div>
      <p className="px-3 pb-1 pt-5 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/35">
        Workspace
      </p>
      <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
        {navigation.map((item) => {
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
      </nav>
      <p className="px-3 pb-1 pt-5 text-[10px] uppercase tracking-[0.18em] text-primary-foreground/35">
        Role views
      </p>
      <nav aria-label="Role views" className="flex flex-col gap-0.5">
        {roleViews.map((item) => {
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
      </nav>
      <div className="mt-auto rounded-md bg-primary-foreground/5 px-2 py-3 ring-1 ring-primary-foreground/10">
        <div className="flex items-center gap-2.5">
          <img
            src={headTeacher}
            alt="Dr. Adaeze Okafor"
            width={512}
            height={512}
            loading="lazy"
            className="size-9 rounded-md object-cover ring-1 ring-primary-foreground/15"
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">Dr. Adaeze Okafor</p>
            <p className="text-[11px] text-primary-foreground/45">Head Teacher</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function SchoolShell({ children, title = "Overview" }: { children: ReactNode; title?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="sticky top-0 hidden h-screen lg:block">
        <Sidebar />
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="relative z-10 h-full"><Sidebar onNavigate={() => setMenuOpen(false)} /></div>
          <button aria-label="Close navigation" className="absolute inset-0 bg-foreground/25" onClick={() => setMenuOpen(false)} />
        </div>
      ) : null}
      <div className="relative min-w-0 flex-1">
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
            <Button size="sm">New entry</Button>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}