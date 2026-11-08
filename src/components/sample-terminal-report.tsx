import { BookOpenCheck, GraduationCap, Sparkles } from "lucide-react";

const sampleSubjects = [
  { name: "English Language", classScore: 42, examScore: 43, total: 85, remark: "Excellent progress" },
  { name: "Mathematics", classScore: 44, examScore: 45, total: 89, remark: "Strong problem-solving" },
  { name: "Science", classScore: 40, examScore: 42, total: 82, remark: "Curious and engaged" },
  { name: "Social Studies", classScore: 43, examScore: 41, total: 84, remark: "Thoughtful contributions" },
];

export function SampleTerminalReport() {
  return (
    <section id="sample-report" className="scroll-mt-20 border-t border-border bg-secondary/20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase text-primary">A clearer picture of progress</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Every learner’s story, beautifully presented.</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">Academic results, attendance, and thoughtful teacher remarks—together in a school-branded terminal report.</p>
          </div>
          <span className="flex w-fit shrink-0 items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground"><Sparkles className="size-4 text-primary" />Fictional sample · Not an official report</span>
        </div>

        <article aria-label="Sample school terminal report" className="glass-panel relative mx-auto max-w-4xl overflow-hidden rounded-lg">
          <div className="h-1 bg-highlight" />
          <header className="flex flex-col items-center gap-4 border-b border-border px-5 py-7 text-center sm:flex-row sm:px-8 sm:text-left">
            <div className="grid size-16 shrink-0 place-items-center rounded-lg border border-primary/20 bg-secondary/70 text-primary"><GraduationCap className="size-9" /></div>
            <div className="min-w-0 flex-1"><p className="font-display text-xl font-bold sm:text-2xl">Klasora Demonstration School</p><p className="mt-1 text-xs text-muted-foreground">Knowledge · Character · Growth</p></div>
            <div><h3 className="text-sm font-semibold">Terminal Report</h3><p className="mt-1 text-xs text-muted-foreground">Term 2 · 2025 / 2026</p></div>
          </header>

          <div className="px-5 py-6 sm:px-8">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-border pb-6 sm:grid-cols-4">
              {[["Learner", "Ama Mensah"], ["Class", "Basic 5"], ["Admission no.", "DEMO-025"], ["Attendance", "58 / 60 days"]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}
            </dl>

            <table className="mt-6 hidden w-full text-left text-sm sm:table">
              <caption className="sr-only">Sample subject results: class score out of 50 plus exam contribution out of 50 equals total out of 100.</caption>
              <thead><tr className="border-b border-border text-xs text-muted-foreground"><th scope="col" className="pb-3 font-medium">Subject</th><th scope="col" className="pb-3 text-center font-medium">Class /50</th><th scope="col" className="pb-3 text-center font-medium">Exam /50</th><th scope="col" className="pb-3 text-center font-medium">Total /100</th><th scope="col" className="pb-3 pl-4 font-medium">Teacher’s note</th></tr></thead>
              <tbody>{sampleSubjects.map(subject => <tr key={subject.name} className="border-b border-border/70"><th scope="row" className="py-4 font-medium">{subject.name}</th><td className="text-center tabular-nums">{subject.classScore}</td><td className="text-center tabular-nums">{subject.examScore}</td><td className="text-center font-semibold tabular-nums text-primary">{subject.total}</td><td className="pl-4 text-xs text-muted-foreground">{subject.remark}</td></tr>)}</tbody>
            </table>

            <div className="mt-5 divide-y divide-border sm:hidden">
              {sampleSubjects.map(subject => <div key={subject.name} className="py-4"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">{subject.name}</h4><span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-sm font-semibold tabular-nums text-secondary-foreground">{subject.total}<span className="text-xs font-normal"> /100</span></span></div><p className="mt-2 text-xs tabular-nums text-muted-foreground">Class: {subject.classScore}/50 <span className="mx-2">·</span> Exam: {subject.examScore}/50</p><p className="mt-2 text-xs text-muted-foreground">{subject.remark}</p></div>)}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border bg-secondary/40 px-4 py-3"><span className="text-sm font-medium">Overall average</span><span className="font-display text-xl font-bold tabular-nums text-primary">85% <span className="text-xs font-medium text-muted-foreground">· Great progress</span></span></div>
            <div className="mt-6 flex gap-3"><BookOpenCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><h4 className="text-xs font-semibold">Class teacher’s remarks</h4><p className="mt-2 text-sm leading-6 text-muted-foreground">Ama is an enthusiastic learner who works well with others. Keep building confidence in reading and continue your excellent effort in mathematics.</p></div></div>
            <div className="mt-7 grid gap-5 border-t border-border pt-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Class teacher</p><p className="mt-1 text-sm font-medium">Mrs. Adjei <span className="font-normal text-muted-foreground">· Sample</span></p></div><div><p className="text-xs text-muted-foreground">Headteacher’s remarks</p><p className="mt-1 text-sm">A commendable term. Keep it up!</p></div></div>
            <p className="mt-6 text-center text-[11px] leading-5 text-muted-foreground">Illustrative names and results only. Exam scores are shown as their contribution out of 50.</p>
          </div>
        </article>
      </div>
    </section>
  );
}