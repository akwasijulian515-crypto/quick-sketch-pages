import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

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

export function PageSkeleton({ title, description, action, icon: Icon, stats }: SkeletonPageProps) {
  return (
    <SchoolShell title={title}>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Icon className="size-5" /></div>
            <h1 className="font-display text-3xl font-bold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          {action ? <Button disabled><Plus />{action}</Button> : null}
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
          <div className="p-10 text-center">
            <p className="font-display text-lg font-bold">No live {title.toLowerCase()} data</p>
            <p className="mt-1 text-sm text-muted-foreground">Connect school records to view this information. Actions are unavailable until the live workflow is connected.</p>
          </div>
        </section>
      </div>
    </SchoolShell>
  );
}