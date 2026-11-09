import { useState } from "react";
import { Check, Eye, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { reportDesigns, useReportDesign, type ReportTemplate } from "@/lib/report-design";
import { sampleReport } from "@/lib/report-sample";
import { TerminalReportView } from "./terminal-report-view";

export function ReportDesignThumbnail({ template }: { template: ReportTemplate }) {
  return <div aria-hidden="true" className={`report-thumbnail thumbnail-${template}`}><div className="thumbnail-heading"><span className="thumbnail-crest" /><div><i /><i /></div></div><div className="thumbnail-identity"><i /><i /><i /></div><div className="thumbnail-table">{[0, 1, 2, 3, 4].map((row) => <div key={row}>{[0, 1, 2, 3].map((cell) => <i key={cell} />)}</div>)}</div><div className="thumbnail-summary"><i /><i /></div><div className="thumbnail-signatures"><i /><i /></div></div>;
}

export function ReportDesignPicker() {
  const branding = useTenantBranding();
  const { template, selectTemplate } = useReportDesign();
  const [selected, setSelected] = useState<ReportTemplate>(template);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const report = sampleReport(branding);
  async function download() {
    setDownloading(true); setError("");
    try { const { downloadTerminalReports } = await import("@/lib/terminal-report-pdf"); await downloadTerminalReports([{ ...report, template: selected }]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download sample."); }
    finally { setDownloading(false); }
  }
  return <section id="report-design" className="mt-8 border-y border-border py-7">
    <div className="mb-6 flex items-start gap-3"><FileText className="mt-1 size-5 shrink-0 text-primary" /><div><h2 className="font-display text-xl font-bold">Terminal report design</h2><p className="mt-2 text-sm text-muted-foreground">{branding.schoolName}</p><p className="mt-1 text-xs text-muted-foreground">Preview only · School-wide saving is not connected yet.</p></div></div>
    <div className="grid gap-4 md:grid-cols-3">{reportDesigns.map((design) => <Button key={design.id} variant="outline" aria-pressed={selected === design.id} onClick={() => { setSelected(design.id); setNotice(""); }} className={`report-design-option h-auto min-w-0 flex-col items-stretch gap-0 whitespace-normal p-4 text-left ${selected === design.id ? "border-primary bg-secondary/30 ring-1 ring-primary" : ""}`}><ReportDesignThumbnail template={design.id} /><span className="mt-4 flex items-center justify-between gap-2 font-display text-base font-semibold">{design.name}{selected === design.id && <Check className="size-4 shrink-0 text-primary" />}</span><span className="mt-1 text-xs font-medium text-primary">{design.subtitle}</span><span className="mt-2 text-xs leading-5 text-muted-foreground">{design.detail}</span></Button>)}</div>
    <div className="mt-5 flex flex-wrap gap-3"><Button variant="outline" onClick={() => setPreview(true)}><Eye />Preview sample</Button><Button onClick={() => { selectTemplate(selected); setNotice("Design applied for this browser session only. Refreshing restores the school default."); }}><Check />Apply preview design</Button></div>
    {notice && <p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{reportDesigns.find((design) => design.id === selected)?.name}</DialogTitle><DialogDescription>Fictional learner details · {branding.schoolName}</DialogDescription></DialogHeader><div className="flex justify-end"><Button variant="outline" disabled={downloading} onClick={() => void download()}><Download />{downloading ? "Preparing…" : "Download sample PDF"}</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<TerminalReportView report={report} template={selected} /></DialogContent></Dialog>
  </section>;
}