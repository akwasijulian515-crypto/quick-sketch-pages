import { useSyncExternalStore } from "react";
import { useTenantBranding } from "@/components/tenant-branding-provider";

export const reportDesigns = [
  { id: "bento", name: "Executive Bento", subtitle: "Modern & luminous", detail: "A clear, modular portrait of achievement." },
  { id: "gazette", name: "Heritage Gazette", subtitle: "Classic & distinguished", detail: "An editorial report with a formal school seal." },
  { id: "ledger", name: "Cambridge Ledger", subtitle: "Precise & academic", detail: "A structured assessment ledger with SBA detail." },
] as const;
export type ReportTemplate = (typeof reportDesigns)[number]["id"];
export function resolveReportTemplate(value: unknown): ReportTemplate {
  return value === "gazette" || value === "ledger" ? value : "bento";
}

// Deliberately transient: Codex will replace this preview override with school settings persistence.
const previews = new Map<string, ReportTemplate>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useReportDesign() {
  const branding = useTenantBranding();
  const template = useSyncExternalStore(subscribe,
    () => previews.get(branding.subdomain) ?? resolveReportTemplate(branding.reportTemplate),
    () => resolveReportTemplate(branding.reportTemplate));
  return { template, selectTemplate: (next: ReportTemplate) => {
    previews.set(branding.subdomain, next);
    listeners.forEach((listener) => listener());
  } };
}