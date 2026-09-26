import type { LucideIcon } from "lucide-react";
import { Filter, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

type SkeletonPageProps = {
  title: string;
  description: string;
  action?: string;
  icon: LucideIcon;
  stats: Array<{ label: string; value: string; note: string }>;
  columns: string[];
};

export function PageSkeleton({ title, description, action, icon: Icon, stats, columns }: SkeletonPageProps) {
  return (
    <SchoolShell title={title}>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Icon className="size-5" /></div>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          {action ? <Button><Plus />{action}</Button> : null}
        </div>

        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="glass-panel rounded-lg p-5">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-2 font-display text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs text-secondary-foreground">{stat.note}</p>
            </article>
          ))}
        </section>

        <section className="glass-panel mt-4 overflow-hidden rounded-lg">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-md border border-input bg-background/70 px-3 text-sm text-muted-foreground">
              <Search className="size-4" /><span>Search {title.toLowerCase()}</span>
            </div>
            <Button variant="outline" size="sm"><Filter />Filter</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>{columns.map((column) => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {[0, 1, 2, 3].map((row) => (
                  <tr key={row}>
                    {columns.map((column, index) => (
                      <td key={column} className="px-5 py-4">
                        <div className={index === 0 ? "h-3 w-28 rounded bg-primary/15" : "h-3 w-20 rounded bg-muted-foreground/15"} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Page framework ready for live school records.</div>
        </section>
      </div>
    </SchoolShell>
  );
}