import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronUp, RotateCcw, Sparkles } from "lucide-react";
import { fetchWithNeonAuth } from "@/auth/client";
import { Button } from "@/components/ui/button";

type OnboardingRole = "school_admin" | "teacher" | "finance" | "parent";

type ChecklistStep = {
  id: string;
  title: string;
  detail: string;
  to:
    | "/academic-setup"
    | "/classes"
    | "/teachers"
    | "/students"
    | "/school-admin"
    | "/teacher"
    | "/finance"
    | "/daily-payments"
    | "/reconciliation"
    | "/parent";
  hash?: string;
};

const stepsByRole: Record<
  OnboardingRole,
  { title: string; description: string; steps: ChecklistStep[] }
> = {
  school_admin: {
    title: "Get your school set up",
    description:
      "Use this checklist to set up the essentials. You can come back to it at any time.",
    steps: [
      {
        id: "school-year",
        title: "Set up the academic year and terms",
        detail: "Choose the dates used for attendance and reports.",
        to: "/academic-setup",
      },
      {
        id: "classes",
        title: "Create your classes",
        detail: "Set up the classes learners will be assigned to.",
        to: "/classes",
      },
      {
        id: "staff",
        title: "Add teachers and subjects",
        detail: "Give staff access and assign their teaching responsibilities.",
        to: "/teachers",
      },
      {
        id: "students",
        title: "Register your students",
        detail: "Add learners individually or import a student list.",
        to: "/students",
      },
      {
        id: "reports",
        title: "Choose a terminal report design",
        detail: "Preview and save your school’s report layout.",
        to: "/school-admin",
      },
    ],
  },
  teacher: {
    title: "Get started in your teacher workspace",
    description: "Your workspace brings class registers, marks, and daily fees together.",
    steps: [
      {
        id: "classes",
        title: "Review your assigned classes",
        detail: "Check that the right learners and subjects are listed.",
        to: "/teacher",
      },
      {
        id: "attendance",
        title: "Open the class register",
        detail: "Record attendance for your assigned class.",
        to: "/teacher",
      },
      {
        id: "marks",
        title: "Enter subject marks",
        detail: "Choose Grades to record assessment results.",
        to: "/teacher",
      },
    ],
  },
  finance: {
    title: "Set up your finance workflow",
    description: "Follow these steps to review balances and record school payments.",
    steps: [
      {
        id: "fees",
        title: "Review outstanding school fees",
        detail: "Select a configured fee and view learner balances.",
        to: "/finance",
      },
      {
        id: "daily-payments",
        title: "Record daily payments",
        detail: "Record the daily collections for your school.",
        to: "/daily-payments",
      },
      {
        id: "reconciliation",
        title: "Review payment reconciliation",
        detail: "Check recorded payments and resolve exceptions.",
        to: "/reconciliation",
      },
    ],
  },
  parent: {
    title: "Explore your family portal",
    description: "See the learners linked to your account and keep up with school progress.",
    steps: [
      {
        id: "children",
        title: "Review your linked children",
        detail: "Confirm the learners shown are linked to your account.",
        to: "/parent",
      },
      {
        id: "results",
        title: "View published results",
        detail: "Open a child’s published terminal report.",
        to: "/parent",
        hash: "published-results",
      },
    ],
  },
};

type SavedChecklist = {
  completed: string[];
  dismissed: boolean;
};

type UserContext = {
  user?: { email?: string };
  membership?: { role?: string; subdomain?: string | null };
};

function isOnboardingRole(role: string | undefined): role is OnboardingRole {
  return role === "school_admin" || role === "teacher" || role === "finance" || role === "parent";
}

function storageKey(role: OnboardingRole, subdomain: string, email: string) {
  return `klasora:onboarding:v1:${encodeURIComponent(subdomain)}:${role}:${encodeURIComponent(email)}`;
}

function readChecklist(raw: string | null, validStepIds: Set<string>): SavedChecklist {
  if (!raw) return { completed: [], dismissed: false };
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Saved onboarding progress is invalid.");
  const saved = parsed as Record<string, unknown>;
  if (
    !Array.isArray(saved["completed"]) ||
    !saved["completed"].every((step) => typeof step === "string" && validStepIds.has(step)) ||
    typeof saved["dismissed"] !== "boolean"
  )
    throw new Error("Saved onboarding progress is invalid.");
  return { completed: saved["completed"], dismissed: saved["dismissed"] };
}

export function UserOnboardingChecklist() {
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState<SavedChecklist>({ completed: [], dismissed: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const requestedTenant =
          new URLSearchParams(window.location.search).get("tenant")?.trim() ||
          sessionStorage.getItem("hg-school")?.trim() ||
          "";
        const contextUrl = requestedTenant
          ? `/api/auth/context?tenant=${encodeURIComponent(requestedTenant)}`
          : "/api/auth/context";
        const response = await fetchWithNeonAuth(contextUrl);
        const payload = (await response.json().catch(() => null)) as
          UserContext | { error?: string } | null;
        if (!response.ok)
          throw new Error(
            payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Could not load your onboarding checklist.",
          );
        if (!payload || !("membership" in payload) || !payload.membership)
          throw new Error("Your school account could not be identified.");

        const currentRole = payload.membership.role;
        if (!isOnboardingRole(currentRole)) {
          if (!cancelled) {
            setRole(null);
            setLoading(false);
          }
          return;
        }
        const email = payload.user?.email?.trim().toLowerCase();
        const subdomain = payload.membership.subdomain?.trim() || requestedTenant;
        if (!email || !subdomain) throw new Error("Your school account could not be identified.");

        const nextKey = storageKey(currentRole, subdomain, email);
        const checklist = stepsByRole[currentRole];
        const nextSaved = readChecklist(
          window.localStorage.getItem(nextKey),
          new Set(checklist.steps.map((step) => step.id)),
        );
        if (!cancelled) {
          setRole(currentRole);
          setKey(nextKey);
          setSaved(nextSaved);
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Could not load your onboarding checklist.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const checklist = role ? stepsByRole[role] : null;
  const completed = useMemo(() => new Set(saved.completed), [saved.completed]);

  function updateChecklist(next: SavedChecklist) {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setSaved(next);
      setError("");
    } catch {
      setError("Could not save your onboarding progress in this browser.");
    }
  }

  if (loading) return null;

  if (error) {
    return (
      <section
        role="alert"
        className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      >
        <p className="text-sm text-destructive">{error}</p>
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry
        </Button>
      </section>
    );
  }

  if (!role || !checklist) return null;

  if (saved.dismissed) {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Getting started · {completed.size} of {checklist.steps.length} complete
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateChecklist({ ...saved, dismissed: false })}
        >
          <Sparkles />
          Show checklist
        </Button>
      </div>
    );
  }

  const finished = completed.size === checklist.steps.length;
  return (
    <section
      aria-labelledby="onboarding-title"
      className="mb-5 overflow-hidden rounded-lg border border-primary/20 bg-card shadow-sm"
    >
      <header className="flex flex-col gap-3 border-b border-border bg-primary/5 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {finished ? <Check className="size-5" /> : <Sparkles className="size-5" />}
          </div>
          <div>
            <h2 id="onboarding-title" className="font-display text-lg font-bold">
              {finished ? "You’re all set!" : checklist.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {finished
                ? "You completed the getting-started checklist. You can restart it whenever you need a refresher."
                : checklist.description}
            </p>
            <p className="mt-2 text-xs font-medium text-primary">
              {completed.size} of {checklist.steps.length} steps complete
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {finished && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateChecklist({ completed: [], dismissed: false })}
            >
              <RotateCcw />
              Restart
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Hide getting-started checklist"
            onClick={() => updateChecklist({ ...saved, dismissed: true })}
          >
            <ChevronUp />
          </Button>
        </div>
      </header>
      {!finished && (
        <ol className="divide-y divide-border">
          {checklist.steps.map((step, index) => {
            const isComplete = completed.has(step.id);
            return (
              <li key={step.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <input
                  type="checkbox"
                  checked={isComplete}
                  aria-label={`Mark “${step.title}” ${isComplete ? "not complete" : "complete"}`}
                  onChange={() => {
                    const next = new Set(saved.completed);
                    if (next.has(step.id)) next.delete(step.id);
                    else next.add(step.id);
                    updateChecklist({ ...saved, completed: [...next] });
                  }}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${isComplete ? "text-muted-foreground line-through" : ""}`}
                  >
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                  <Link
                    to={step.to}
                    {...(step.hash ? { hash: step.hash } : {})}
                    className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Go to this step
                    <ChevronDown className="size-3 -rotate-90" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
