import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheck,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klasora | School operations, made clearer" },
      {
        name: "description",
        content: "One clear workspace for school administration, teaching, student records, attendance, and finance.",
      },
      { property: "og:title", content: "Klasora | School operations, made clearer" },
      {
        property: "og:description",
        content: "A simpler way to bring your school's daily operations together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const features = [
  {
    icon: GraduationCap,
    title: "Student records",
    description: "Keep learner details and school records organized in one place.",
  },
  {
    icon: CalendarDays,
    title: "Attendance",
    description: "Give teachers a clear, consistent way to manage daily registers.",
  },
  {
    icon: CreditCard,
    title: "School finance",
    description: "Bring fee setup, collections, and reconciliation into view.",
  },
  {
    icon: BookOpenCheck,
    title: "Teaching & learning",
    description: "Connect classes, subjects, teaching teams, and academic progress.",
  },
];

function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background font-body text-foreground">
      <header className="relative z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        >
          <Link to="/" className="flex items-center gap-2.5" aria-label="Klasora home">
            <span className="grid size-9 place-items-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">
              K
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Klasora</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Register your school<ArrowRight /></Link>
            </Button>
          </div>
        </nav>
      </header>

      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 ambient-wash" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div className="rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              A calmer way to run your school
            </div>
            <h1 className="mt-6 max-w-2xl font-display text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              More time for
              <span className="text-primary"> learning.</span>
              <br />
              Less time lost to admin.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Klasora brings the everyday work of your school into one clear workspace—from
              student records and attendance to teaching and finance.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">Create your school workspace<ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Sign in to Klasora</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {["Your school, your workspace", "Built for everyday school teams"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <CircleCheck className="size-3.5 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rise relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-primary/5 blur-2xl" />
            <div className="glass-panel overflow-hidden rounded-xl shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">K</div>
                  <div>
                    <p className="text-sm font-semibold">School workspace</p>
                    <p className="text-xs text-muted-foreground">Everything in its place</p>
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">Overview</span>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <PreviewCard icon={GraduationCap} label="Student records" detail="A clearer view of your learners" />
                <PreviewCard icon={ChartNoAxesCombined} label="Attendance" detail="Daily registers for your team" />
                <PreviewCard icon={CreditCard} label="Finance" detail="Fees and collections together" />
                <PreviewCard icon={UsersRound} label="Teaching teams" detail="Classes, teachers, and subjects" />
              </div>
              <div className="mx-5 mb-5 flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 p-4">
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-background text-primary shadow-sm">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">A workspace for your school</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Your people and daily processes, organized around your school.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-y border-border/70 bg-muted/25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">One connected workspace</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              The essentials, working together.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
              Give your school team a shared place to manage the work that keeps learning moving.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="glass-panel rounded-lg p-5">
                <div className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Getting started</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your school. Your space.</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
              Start with your school’s workspace. Once it’s approved, invite your team and make it your own.
            </p>
            <Button asChild className="mt-6">
              <Link to="/signup">Register your school<ArrowRight /></Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Apply", "Tell us about your school."],
              ["02", "Get approved", "We review your workspace request."],
              ["03", "Bring your team", "Sign in and get started together."],
            ].map(([number, title, description]) => (
              <article key={number} className="rounded-lg border border-border bg-background/70 p-5">
                <span className="font-mono text-xs font-semibold text-primary">{number}</span>
                <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/70 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-display font-bold" aria-label="Klasora home">
            <span className="grid size-8 place-items-center rounded-md bg-primary-foreground/10">K</span>
            Klasora
          </Link>
          <p className="text-xs text-primary-foreground/65">A clearer workspace for school communities.</p>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/login" className="text-primary-foreground/75 hover:text-primary-foreground">Sign in</Link>
            <Link to="/signup" className="text-primary-foreground/75 hover:text-primary-foreground">Register your school</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PreviewCard({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof GraduationCap;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </div>
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
