import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle2, ChevronLeft, ImagePlus, Palette, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your school workspace" }, { name: "description", content: "Apply for a branded school workspace." }] }),
  component: SchoolSignupPage,
});

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const maxCrestBytes = 512 * 1024;
const optimizedCrestBytes = 480 * 1024;
const supportedCrestTypes = ["image/png", "image/jpeg", "image/webp"];

async function fileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the crest image"));
    reader.onerror = () => reject(new Error("Could not read the crest image"));
    reader.readAsDataURL(file);
  });
}

async function optimizeCrest(file: File): Promise<string> {
  if (!supportedCrestTypes.includes(file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP image");
  }
  if (file.size <= maxCrestBytes) return fileAsDataUrl(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This crest image could not be opened. Try another PNG, JPEG, or WebP image");
  }

  try {
    const canvas = document.createElement("canvas");
    const initialScale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    let scale = initialScale;

    while (scale >= 0.2) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not resize this crest image");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
        const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (compressed && compressed.size <= optimizedCrestBytes) return fileAsDataUrl(compressed);
      }
      scale *= 0.8;
    }
  } finally {
    bitmap.close();
  }

  throw new Error("This crest image could not be reduced below 512 KB. Try a smaller image");
}

function SchoolSignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState("#1f5c3b");
  const [crest, setCrest] = useState<string | null>(null);
  const [crestError, setCrestError] = useState("");
  const [optimizingCrest, setOptimizingCrest] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function next(event: FormEvent) { event.preventDefault(); setStep((current) => Math.min(current + 1, 3)); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (optimizingCrest) return;
    try {
      const response = await fetch("/api/onboarding/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolName, subdomain, contactName: adminName, email, phone, primaryColor: color, crestUrl: crest }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not submit your application");
      setSubmitted(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not submit your application");
    }
  }
  async function loadCrest(file: File | undefined) {
    if (!file) return;
    setCrestError("");
    setOptimizingCrest(file.size > maxCrestBytes);
    try {
      setCrest(await optimizeCrest(file));
    } catch (error) {
      setCrestError(error instanceof Error ? error.message : "Could not process the crest image");
    } finally {
      setOptimizingCrest(false);
    }
  }

  if (submitted) return <div className="relative grid min-h-screen place-items-center bg-background px-4 font-body text-foreground"><div className="pointer-events-none fixed inset-0 ambient-wash" /><main className="glass-panel rise relative w-full max-w-md rounded-lg p-8 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-700"><CheckCircle2 className="size-6" /></div><h1 className="mt-5 font-display text-2xl font-bold">Application received</h1><p className="mt-2 text-sm text-muted-foreground">We&apos;ll review <strong>{schoolName}</strong> and email {email} once the {subdomain}.yourdomain.com workspace is approved.</p><Button className="mt-6" onClick={() => navigate({ to: "/login" })}>Return to sign in</Button></main></div>;

  return <div className="relative min-h-screen bg-background px-4 py-8 font-body text-foreground sm:py-12"><div className="pointer-events-none fixed inset-0 ambient-wash" /><main className="relative mx-auto max-w-5xl"><Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Back to sign in</Link><div className="mt-6 grid gap-6 lg:grid-cols-5"><section className="glass-panel rise rounded-lg p-6 sm:p-8 lg:col-span-3"><div className="flex items-start justify-between gap-4"><div><div className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Building2 className="size-5" /></div><h1 className="mt-4 font-display text-3xl font-bold">Create your school workspace</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Apply for a secure, branded school tenant. Your workspace is created only after platform approval.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Step {step} of 3</span></div><div className="mt-6 flex gap-2">{[1, 2, 3].map((item) => <div key={item} className="h-1 flex-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: item <= step ? "100%" : "0%" }} /></div>)}</div>{step === 1 && <form onSubmit={next} className="mt-7 space-y-4"><Field label="School name"><input required value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setSubdomain(slugify(event.target.value)); }} placeholder="e.g. Sunrise International School" className="input" /></Field><Field label="Requested school address"><div className="flex h-10 items-center rounded-md border border-input bg-background/70 focus-within:ring-2 focus-within:ring-ring"><input required value={subdomain} onChange={(event) => setSubdomain(slugify(event.target.value))} placeholder="sunrise" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" /><span className="pr-3 text-xs text-muted-foreground">.yourdomain.com</span></div></Field><p className="text-xs text-muted-foreground">The address must be unique and can only be used after approval.</p><Actions label="Continue" /></form>}{step === 2 && <form onSubmit={next} className="mt-7 space-y-4"><Field label="Primary School Admin"><input required value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Full name" className="input" /></Field><Field label="Work email"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@school.edu.gh" className="input" /></Field><Field label="Phone number"><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. +233 24 000 0000" className="input" /></Field><Actions back={() => setStep(1)} label="Continue" /></form>}{step === 3 && <form onSubmit={submit} className="mt-7 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Primary brand colour"><div className="flex h-10 items-center gap-3 rounded-md border border-input bg-background/70 px-3"><input aria-label="Primary brand colour" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /><span className="font-mono text-sm uppercase">{color}</span></div></Field><Field label="School badge / crest"><label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background/70 px-3 text-sm text-muted-foreground hover:border-primary"><ImagePlus className="size-4" />{optimizingCrest ? "Optimizing image..." : crest ? "Crest selected" : "Upload image"}<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" disabled={optimizingCrest} onChange={(event) => { void loadCrest(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label></Field></div>{crestError && <p role="alert" className="text-sm text-destructive">{crestError}</p>}{optimizingCrest && <p role="status" className="text-sm text-muted-foreground">Resizing and compressing your crest locally before upload...</p>}{crest && <p className="text-xs text-muted-foreground">Oversized images are optimized in your browser before submission.</p>}<div className="rounded-md border border-border bg-background/60 p-4 text-sm"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><span className="font-medium">Before you submit</span></div><p className="mt-2 text-muted-foreground">A Super Admin reviews this application. We do not create an active tenant or sign-in page until it has been approved.</p></div><Actions back={() => setStep(2)} label="Submit application" /></form>}</section><aside className="glass-panel rise rounded-lg p-6 lg:col-span-2"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Live school preview</p><div className="mt-5 rounded-lg p-5 text-white" style={{ backgroundColor: color }}><div className="flex items-center gap-3">{crest ? <img src={crest} alt="School crest preview" className="size-11 rounded-md object-cover ring-1 ring-white/30" /> : <div className="grid size-11 place-items-center rounded-md bg-white/15 font-display text-lg font-bold">{schoolName.charAt(0).toUpperCase() || "S"}</div>}<div><p className="font-display text-base font-bold">{schoolName || "Your school"}</p><p className="text-xs text-white/70">School portal</p></div></div><div className="mt-8 rounded-md bg-white/10 p-3"><p className="text-xs text-white/70">Tenant address</p><p className="mt-1 font-mono text-xs">{subdomain || "school"}.yourdomain.com</p></div></div><p className="mt-5 text-xs text-muted-foreground">Crest images are previewed in your browser. Production uploads will use tenant-scoped object storage.</p></aside></div></main></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function Actions({ back, label, disabled }: { back?: () => void; label: string; disabled?: boolean }) { return <div className="flex justify-between gap-2 pt-2">{back ? <Button type="button" variant="outline" onClick={back}>Back</Button> : <span />}{<Button type="submit" disabled={disabled}>{label}</Button>}</div>; }
