import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CircleCheck,
  CreditCard,
  GraduationCap,
  UsersRound,
  Palette,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SampleTerminalReport } from "@/components/sample-terminal-report";
import schoolCourtyard from "@/assets/school-courtyard.jpg";
import classroomLearning from "@/assets/classroom-learning.jpg";

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
          className="mx-auto grid min-h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 sm:flex sm:justify-between sm:gap-4 sm:px-6 lg:px-8"
        >
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Klasora home">
            <img src="/brand/klasora-logo-horizontal.png" alt="Klasora" className="h-9 w-auto max-w-full object-contain" />
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#community" className="transition-colors hover:text-foreground">Our community</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">Getting started</a>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="max-[420px]:px-2">
              <Link to="/signup">
                <span className="min-[421px]:hidden">Register</span>
                <span className="hidden min-[421px]:inline">Register your school</span>
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <section className="homepage-cover relative isolate flex items-center overflow-hidden">
        <img src={schoolCourtyard} alt="A teacher and pupils walking together through a school courtyard" width={1536} height={1024} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center]" />
        <div className="homepage-cover-shade absolute inset-0 -z-10" />
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
          <div className="rise max-w-xl">
            <p className="text-sm font-medium text-highlight">For the people who make school happen</p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-tight sm:text-6xl">Klasora</h1>
            <p className="mt-4 text-2xl font-medium leading-snug sm:text-3xl">More time for learning.<br />Less time lost to admin.</p>
            <p className="mt-5 max-w-md text-base leading-7 opacity-90">Bring your school’s everyday work together—from the morning register to the end-of-term report.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-auto min-h-11 whitespace-normal bg-highlight px-5 text-highlight-foreground hover:bg-highlight/90">
                <Link to="/signup">Register your school<ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-auto min-h-11 border-sidebar-foreground/40 bg-transparent px-5 text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-7 flex items-center gap-2 text-xs opacity-90"><CircleCheck className="size-4 shrink-0" />Your school’s name, crest, and colours. Your own space.</p>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-y border-border/70 bg-muted/25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">One connected workspace</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
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

      <section id="community" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <figure className="overflow-hidden rounded-lg">
            <img src={classroomLearning} alt="A teacher helping pupils with their exercise books in the classroom" width={1280} height={1024} loading="lazy" className="aspect-[5/4] w-full object-cover" />
            <figcaption className="border-b border-border py-3 text-xs text-muted-foreground">Behind every school day are people making a difference.</figcaption>
          </figure>
          <div>
            <p className="text-xs font-semibold uppercase text-primary">A whole school, connected</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">People first.<br />Paperwork second.</h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">School runs better when everyone has a clear view of what matters. Give your team a shared workspace and keep families close to their children’s progress.</p>
            <div className="mt-7 divide-y divide-border">
              {[
                [BookOpenCheck, "For teachers", "Attendance, marks, and reports—without losing sight of the learner."],
                [UsersRound, "For school teams", "Student records, teaching assignments, and fee collections in one place."],
                [GraduationCap, "For families & learners", "Stay connected to attendance, learning progress, and school fees."],
              ].map(([Icon, title, description]) => {
                const RoleIcon = Icon as typeof GraduationCap;
                return <div key={String(title)} className="flex gap-4 py-5"><RoleIcon className="mt-1 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{String(title)}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{String(description)}</p></div></div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/35">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[auto_1fr_auto] md:items-center lg:px-8">
          <div className="grid size-14 place-items-center rounded-lg border border-border bg-background text-primary"><Palette className="size-7" /></div>
          <div className="max-w-2xl"><h2 className="font-display text-2xl font-bold">Feels like your school. Because it is.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your name, your crest, your chosen colour. A familiar school identity across a workspace that fits phones, tablets, and desktops—with light and dark themes.</p></div>
          <Button asChild variant="outline" className="w-fit"><Link to="/signup">Make it yours<ArrowRight /></Link></Button>
        </div>
      </section>

      <SampleTerminalReport />

      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">Getting started</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Your school. Your space.</h2>
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

      <section id="questions" className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div><p className="text-xs font-semibold uppercase text-primary">Before you get started</p><h2 className="mt-3 font-display text-3xl font-bold">A few common questions.</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">Have something else in mind? Reach us using the contact details below.</p></div>
          <div className="divide-y divide-border border-y border-border">
            {[
              ["How does my school join?", "Register your school and submit your details for review. Once your application is approved, you can sign in to your school’s workspace."],
              ["Can we use our own school branding?", "Yes. Your school’s name, crest, and dominant colour carry through to its workspace, including light and dark themes."],
              ["Who is the workspace for?", "School administrators, teachers, finance staff, students, and parents each have their own role in the school workspace."],
              ["Can I use Klasora on my phone?", "Yes. The school workspace adapts to phones, tablets, and desktop screens, so you can work from the device that suits you."],
            ].map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">{question}<Plus className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45 motion-reduce:transition-none" /></summary><p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center lg:px-8"><div><h2 className="font-display text-2xl font-bold sm:text-3xl">Make room for a better school day.</h2><p className="mt-3 text-sm text-muted-foreground">Bring your people, records, and daily routines together.</p></div><Button asChild size="lg" className="h-auto min-h-11 w-fit whitespace-normal px-5"><Link to="/signup">Register your school<ArrowRight /></Link></Button></div>
      </section>

      <footer className="border-t border-border/70 bg-[var(--brand-deep)] text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8">
          <div className="min-w-0">
            <Link to="/" className="flex w-fit items-center" aria-label="Klasora home">
              <img src="/brand/klasora-logo-reversed.png" alt="Klasora" className="h-8 w-auto max-w-full object-contain" />
            </Link>
            <p className="mt-3 text-xs leading-6 text-primary-foreground/65">A clearer workspace for school communities.</p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-3 text-sm sm:grid-cols-1 sm:justify-self-end lg:justify-self-start">
            <Link to="/login" className="flex min-h-11 items-center text-primary-foreground/75 hover:text-primary-foreground">Sign in</Link>
            <Link to="/signup" className="flex min-h-11 items-center text-primary-foreground/75 hover:text-primary-foreground">Register your school</Link>
          </div>
          <div className="grid min-w-0 gap-1 border-t border-primary-foreground/15 pt-4 text-sm text-primary-foreground/75 sm:col-span-2 lg:col-span-1 lg:border-t-0 lg:pt-0 lg:text-right">
            <a href="mailto:akwasiJulian515@gmail.com" className="flex min-h-11 min-w-0 items-center break-all hover:text-primary-foreground lg:justify-end">akwasiJulian515@gmail.com</a>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-1">
              <a href="tel:+233551587723" className="flex min-h-11 items-center hover:text-primary-foreground lg:justify-end">0551587723</a>
              <a href="tel:+233596466723" className="flex min-h-11 items-center hover:text-primary-foreground lg:justify-end">0596466723</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

