import { useState } from "react";

import { Button } from "@/components/ui/button";

type DailyPaymentControlsProps = {
  paid: boolean;
  dailyFeeConfigured: boolean;
  splitEnabled: boolean;
  feedingConfigured: boolean;
  canRecord: boolean;
  busy: boolean;
  onRecord: (schoolDays: number, includeFeeding: boolean) => void;
};

export function DailyPaymentControls({
  paid,
  dailyFeeConfigured,
  splitEnabled,
  feedingConfigured,
  canRecord,
  busy,
  onRecord,
}: DailyPaymentControlsProps) {
  const [schoolDays, setSchoolDays] = useState(1);

  if (!canRecord) return <span className="text-xs text-muted-foreground">Read only</span>;
  if (!dailyFeeConfigured)
    return <span className="text-xs text-muted-foreground">Daily fee not configured</span>;

  const recordLabel = `${schoolDays} ${schoolDays === 1 ? "day" : "days"}`;

  return (
    <div className="w-full min-w-48 space-y-2 rounded-md border border-border bg-background p-3">
      <label className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground">
        Days to cover
        <select
          aria-label="School days to cover"
          value={schoolDays}
          disabled={busy}
          onChange={(event) => setSchoolDays(Number(event.target.value))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          {Array.from({ length: 30 }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {count} {count === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Earlier unpaid school days are included; weekends, holidays, and already-paid days are
        skipped.
      </p>
      {splitEnabled ? (
        <div className="flex flex-col items-stretch gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onRecord(schoolDays, false)}
          >
            {busy ? "Recording..." : `Studies only · ${recordLabel}`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !feedingConfigured}
            onClick={() => onRecord(schoolDays, true)}
          >
            Studies + feeding · {recordLabel}
          </Button>
          {!feedingConfigured && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Add an active Daily feeding fee rule for this class in School Admin → Class fee rules
              to enable this option.
            </p>
          )}
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={busy}
          onClick={() => onRecord(schoolDays, false)}
        >
          {busy ? "Recording..." : `${paid ? "Record more" : "Record"} · ${recordLabel}`}
        </Button>
      )}
    </div>
  );
}
