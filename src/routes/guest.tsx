import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, Phone, Receipt, Search, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guest")({
  head: () => ({
    meta: [
      { title: "Guest help desk — Klasora" },
      { name: "description", content: "Look up your ward's class, attendance and fees, and pay without an account." },
      { property: "og:title", content: "Guest help desk — Klasora" },
      { property: "og:description", content: "Look up your ward's class, attendance and fees, and pay without an account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestPage,
});

type Ward = {
  name: string;
  id: string;
  form: string;
  teacher: string;
  teacherPhone: string;
  consultation: string;
  average: string;
  position: string;
  remark: string;
  attendance: number;
  present: number;
  late: number;
  absent: number;
  balance: number;
  due: string;
};

const wards: Ward[] = [
  {
    name: "Kwame Asante",
    id: "HG-2201",
    form: "Form 2B",
    teacher: "Mr. Okoye",
    teacherPhone: "0302 555 114",
    consultation: "Tue & Thu, 2–4pm",
    average: "78%",
    position: "4th of 32",
    remark: "Steady work. Should speak up more in class discussions.",
    attendance: 96,
    present: 58,
    late: 2,
    absent: 2,
    balance: 0,
    due: "Settled",
  },
  {
    name: "Ama Boateng",
    id: "HG-2207",
    form: "Form 2B",
    teacher: "Mr. Okoye",
    teacherPhone: "0302 555 114",
    consultation: "Tue & Thu, 2–4pm",
    average: "85%",
    position: "1st of 32",
    remark: "Excellent term. A pleasure to teach.",
    attendance: 93,
    present: 55,
    late: 4,
    absent: 3,
    balance: 350,
    due: "Due 15 October",
  },
  {
    name: "Yaw Mensah",
    id: "HG-2214",
    form: "Form 2B",
    teacher: "Mr. Okoye",
    teacherPhone: "0302 555 114",
    consultation: "Tue & Thu, 2–4pm",
    average: "69%",
    position: "12th of 32",
    remark: "Improving in maths. Homework needs closer attention.",
    attendance: 90,
    present: 53,
    late: 5,
    absent: 4,
    balance: 120,
    due: "Due 15 October",
  },
];

function GuestPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState("MTN Mobile Money");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ ref: string; amount: string; phone: string } | null>(null);

  const q = query.trim().toLowerCase();
  const ward = wards.find((w) => w.name.toLowerCase() === q || w.id.toLowerCase() === q);

  function lookUp(value: string) {
    setQuery(value);
    setName(value);
    setPaying(false);
    setReceipt(null);
    setError("");
    const found = wards.find((w) => w.name.toLowerCase() === value.trim().toLowerCase());
    setAmount(found && found.balance > 0 ? String(found.balance) : "");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    lookUp(name);
  }

  function pay(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!phone.trim() || phone.replace(/\D/g, "").length < 9) {
      setError("Enter a valid phone number for the receipt.");
      return;
    }
    if (!value || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setError("");
    setReceipt({
      ref: `HG${Math.floor(100000 + Math.random() * 899999)}`,
      amount: value.toFixed(2),
      phone: phone.trim(),
    });
    setPaying(false);
  }

  return (
    <div className="relative min-h-screen bg-background px-4 py-10 font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="relative mx-auto w-full max-w-2xl space-y-4">
        <div className="glass-panel rise rounded-lg p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold">Guest help desk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your ward's full name or student ID — no account needed.
          </p>

          <form onSubmit={submit} className="mt-5 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kwame Asante or HG-2201"
                className="h-10 w-full rounded-md border border-input bg-background/70 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit">Find</Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {wards.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => lookUp(w.name)}
                className={cn(
                  "rounded-full border border-border px-3 py-1 text-xs transition-colors",
                  ward?.id === w.id ? "border-primary bg-primary/10 text-primary" : "bg-background/60 hover:bg-muted",
                )}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        {query && !ward ? (
          <div className="glass-panel rounded-lg p-5 text-sm text-muted-foreground">
            We couldn't find "{query}". Check the spelling, or call the front office on 0302 555 100.
          </div>
        ) : null}

        {ward ? (
          <>
            <div className="glass-panel rise rounded-lg p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-bold">{ward.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ward.id} · {ward.form} · 2026 academic year
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                  Term average {ward.average}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Stat label="Class position" value={ward.position} />
                <Stat label="Attendance" value={`${ward.attendance}%`} />
                <Stat label="Fees" value={ward.balance > 0 ? `GH₵ ${ward.balance}` : "Fully paid"} />
              </div>

              <p className="mt-4 rounded-md border border-border bg-background/60 p-3 text-sm">
                <span className="font-medium">Teacher's remark: </span>
                {ward.remark}
              </p>
            </div>

            <div className="glass-panel rounded-lg p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <CalendarCheck className="size-4" /> Attendance this term
              </h2>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${ward.attendance}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {ward.present} present · {ward.late} late · {ward.absent} absent
              </p>
            </div>

            <div className="glass-panel rounded-lg p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Phone className="size-4" /> Class teacher
              </h2>
              <p className="mt-2 text-sm">{ward.teacher}</p>
              <p className="text-xs text-muted-foreground">
                {ward.teacherPhone} · Available {ward.consultation}
              </p>
            </div>

            <div className="glass-panel rounded-lg p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Wallet className="size-4" /> School fees
              </h2>
              <p className="mt-2 text-sm">
                {ward.balance > 0 ? (
                  <>
                    Outstanding balance <span className="font-display font-bold">GH₵ {ward.balance}.00</span> · {ward.due}
                  </>
                ) : (
                  <>No outstanding balance. Thank you.</>
                )}
              </p>

              {receipt ? (
                <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium text-primary">
                    <CheckCircle2 className="size-4" /> Payment received
                  </p>
                  <p className="mt-2">Reference {receipt.ref}</p>
                  <p>GH₵ {receipt.amount} paid for {ward.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Receipt className="size-3.5" /> Receipt sent by text to {receipt.phone}
                  </p>
                </div>
              ) : paying ? (
                <form onSubmit={pay} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Payment method</span>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option>MTN Mobile Money</option>
                      <option>Telecel Cash</option>
                      <option>AT Money</option>
                      <option>Bank card</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Phone number for receipt</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="024 000 0000"
                      className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Amount (GH₵)</span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">Pay & text receipt</Button>
                    <Button type="button" variant="ghost" onClick={() => setPaying(false)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <Button className="mt-4" onClick={() => setPaying(true)}>
                  {ward.balance > 0 ? "Pay fees now" : "Make a payment"}
                </Button>
              )}
            </div>
          </>
        ) : null}

        <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/login" })}>
          Back to sign in
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
