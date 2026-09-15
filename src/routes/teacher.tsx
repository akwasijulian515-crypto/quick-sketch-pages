import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCheck,
  LayoutDashboard,
  LogOut,
  Trash2,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Portal — Harrow Green" },
      { name: "description", content: "Teacher dashboard, mark entry, attendance, and lesson materials." },
      { property: "og:title", content: "Teacher Portal — Harrow Green" },
      { property: "og:description", content: "Teacher dashboard, mark entry, attendance, and lesson materials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherPortal,
});

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "marks", label: "Mark entry", icon: CheckCheck },
  { id: "attendance", label: "Attendance", icon: UserRoundCheck },
  { id: "materials", label: "Materials", icon: Upload },
] as const;

type TabId = (typeof tabs)[number]["id"];

const students = [
  "Kwame Asante",
  "Ama Boateng",
  "Yaw Mensah",
  "Efua Darko",
  "Kojo Antwi",
  "Adwoa Nyarko",
  "Kofi Owusu",
  "Abena Sarpong",
];

const weekBars = [
  { day: "Mon", value: 92 },
  { day: "Tue", value: 96 },
  { day: "Wed", value: 88 },
  { day: "Thu", value: 94 },
  { day: "Fri", value: 90 },
];

const activity = [
  ["Marked Wednesday's register for Form 2B.", "Today · 08:12"],
  ["Uploaded Mathematics lesson notes (Week 9).", "Yesterday"],
  ["Submitted Integrated Science mid-term scores.", "Mon · 15:40"],
];

const subjects = ["Mathematics", "Integrated Science", "English Language", "Social Studies"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="glass-panel rise rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="mt-1 text-xs text-secondary-foreground">{note}</p>
    </article>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel rise mt-4 overflow-hidden rounded-lg">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}

function TeacherPortal() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<TabId>("dashboard");

  useEffect(() => {
    if (sessionStorage.getItem("hg-role") === "teacher") setAllowed(true);
    else navigate({ to: "/login" });
  }, [navigate]);

  if (!allowed) return null;

  return (
    <div className="relative min-h-screen bg-background font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">H</div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Teacher Portal</p>
            <p className="text-[11px] text-muted-foreground">Mr. Okoye · Form 2B</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem("hg-role");
            navigate({ to: "/login" });
          }}
        >
          <LogOut />Sign out
        </Button>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Good morning, Mr. Okoye</h1>
            <p className="mt-1 text-sm text-muted-foreground">Form 2B · {students.length} students on the register.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <Button key={id} variant={tab === id ? "default" : "outline"} size="sm" onClick={() => setTab(id)}>
                <Icon />{label}
              </Button>
            ))}
          </div>
        </div>

        {tab === "dashboard" ? <Dashboard /> : null}
        {tab === "marks" ? <MarkEntry /> : null}
        {tab === "attendance" ? <Attendance /> : null}
        {tab === "materials" ? <Materials /> : null}
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card label="Total students" value={String(students.length)} note="Form 2B register" />
        <Card label="Present today" value="6" note="2 yet to arrive" />
        <Card label="Pending materials" value="3" note="Lessons to upload" />
      </section>

      <Panel title="Attendance this week" note="Daily attendance rate for Form 2B.">
        <div className="flex items-end gap-4 px-5 py-6" style={{ height: 180 }}>
          {weekBars.map((bar) => (
            <div key={bar.day} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">{bar.value}%</span>
              <div className="w-full rounded-t bg-secondary-foreground/80" style={{ height: `${bar.value}%` }} />
              <span className="text-xs text-muted-foreground">{bar.day}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent activity" note="Your latest actions.">
        <div className="divide-y divide-border/70 px-5">
          {activity.map(([text, time]) => (
            <div key={text} className="flex items-start gap-3 py-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary-foreground" />
              <p className="text-sm">{text}</p>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{time}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function MarkEntry() {
  const [date, setDate] = useState(today());
  const [present, setPresent] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(students.map((s) => [s, true])),
  );
  const [saved, setSaved] = useState(false);
  const count = students.filter((s) => present[s]).length;

  function setAll(value: boolean) {
    setPresent(Object.fromEntries(students.map((s) => [s, value])));
    setSaved(false);
  }

  return (
    <Panel title="Mark entry" note="Pick a date, then mark each student present or absent.">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <label className="flex items-center gap-2 text-sm">
          <CalendarDays className="size-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(event) => { setDate(event.target.value); setSaved(false); }}
            className="h-9 rounded-md border border-input bg-background/70 px-3 text-sm"
          />
        </label>
        <Button variant="outline" size="sm" onClick={() => setAll(true)}>Mark all present</Button>
        <Button variant="outline" size="sm" onClick={() => setAll(false)}>Mark all absent</Button>
        <span className="ml-auto text-xs text-muted-foreground">{count} of {students.length} present</span>
      </div>

      <ul className="divide-y divide-border/70">
        {students.map((student) => (
          <li key={student} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm">{student}</span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(present[student])}
                onChange={(event) => { setPresent((p) => ({ ...p, [student]: event.target.checked })); setSaved(false); }}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              {present[student] ? "Present" : "Absent"}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 border-t border-border px-5 py-3">
        <Button size="sm" onClick={() => setSaved(true)}>Save register</Button>
        {saved ? <span className="text-xs text-secondary-foreground">Saved for {date} (preview only).</span> : null}
      </div>
    </Panel>
  );
}

const classes = ["All classes", "Form 2B · Section A", "Form 2B · Section B"];

function Attendance() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const [selected, setSelected] = useState(now.getDate());
  const [klass, setKlass] = useState(classes[0]);

  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <>
      <Panel title={`Attendance · ${monthLabel}`} note="Click a date to open that day's register.">
        <div className="px-5 py-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              return (
                <button
                  key={day}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "aspect-square rounded-md text-sm transition-colors",
                    selected === day
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/70 ring-1 ring-border hover:bg-secondary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel title={`Student attendance · ${selected} ${monthLabel}`} note="Attendance percentage for the term.">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <select
            value={klass}
            onChange={(event) => setKlass(event.target.value)}
            className="h-9 rounded-md border border-input bg-background/70 px-3 text-sm"
          >
            {classes.map((option) => <option key={option}>{option}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">Showing {klass.toLowerCase()}</span>
        </div>
        <ul className="divide-y divide-border/70">
          {students.map((student, index) => {
            const percent = 98 - index * 3;
            return (
              <li key={student} className="flex items-center gap-4 px-5 py-3">
                <span className="w-40 shrink-0 text-sm">{student}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
                  <div className="h-full rounded-full bg-secondary-foreground" style={{ width: `${percent}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{percent}%</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

function Materials() {
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(today());
  const [files, setFiles] = useState<Array<{ id: number; name: string; subject: string; date: string }>>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPending((current) => [...current, ...Array.from(list)]);
    setError("");
  }

  function upload() {
    if (!subject) return setError("Select a subject.");
    if (!date) return setError("Choose a lesson date.");
    if (pending.length === 0) return setError("Add at least one file.");
    setFiles((current) => [
      ...current,
      ...pending.map((file, index) => ({ id: Date.now() + index, name: file.name, subject, date })),
    ]);
    setPending([]);
    setError("");
  }

  return (
    <Panel title="Upload lesson materials" note="Attach notes, slides, or worksheets for your class.">
      <div className="space-y-4 px-5 py-5">
        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-primary bg-secondary/60" : "border-border bg-background/60",
          )}
        >
          <Upload className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drag files here or click to browse</p>
          <p className="text-xs text-muted-foreground">PDF, Word, slides or images</p>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
        </div>

        {pending.length > 0 ? (
          <p className="text-xs text-secondary-foreground">{pending.length} file(s) ready: {pending.map((f) => f.name).join(", ")}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-9 rounded-md border border-input bg-background/70 px-3 text-sm"
          >
            <option value="">Select subject</option>
            {subjects.map((option) => <option key={option}>{option}</option>)}
          </select>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 rounded-md border border-input bg-background/70 px-3 text-sm"
          />
          <Button size="sm" onClick={upload}>Upload</Button>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="border-t border-border">
        {files.length === 0 ? (
          <p className="px-5 py-4 text-xs text-muted-foreground">No materials uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{file.subject} · {file.date}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label={`Delete ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
