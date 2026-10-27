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
    <div className="w-full min-w-0 space-y-2 rounded-md border border-border bg-background p-3">
      <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs font-semibold text-foreground">
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
        Starts on the selected date; skips weekends, holidays, and recorded dates.
      </p>
      {splitEnabled ? (
        <div className="flex flex-col items-stretch gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-auto min-h-9 w-full whitespace-normal px-2 py-2 text-center leading-tight"
            disabled={busy}
            onClick={() => onRecord(schoolDays, false)}
          >
            <span>
              <span className="block">{busy ? "Recording..." : "Studies only"}</span>
              {!busy && <span className="block text-[11px] font-normal">{recordLabel}</span>}
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-auto min-h-9 w-full whitespace-normal px-2 py-2 text-center leading-tight"
            disabled={busy || !feedingConfigured}
            onClick={() => onRecord(schoolDays, true)}
          >
            <span>
              <span className="block">Studies + feeding</span>
              <span className="block text-[11px] font-normal">{recordLabel}</span>
            </span>
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
          className="h-auto min-h-9 w-full whitespace-normal px-2 py-2 text-center leading-tight"
          disabled={busy}
          onClick={() => onRecord(schoolDays, false)}
        >
          <span>
            <span className="block">
              {busy ? "Recording..." : paid ? "Record more" : "Mark Paid"}
            </span>
            {!busy && <span className="block text-[11px] font-normal">{recordLabel}</span>}
          </span>
        </Button>
      )}
    </div>
  );
}
