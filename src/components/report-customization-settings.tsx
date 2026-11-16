import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fetchWithNeonAuth } from "@/auth/client";
import {
  defaultReportCustomizationSettings,
  type ReportCustomizationSettings,
} from "@/lib/report-customization";
import { useTenantBranding } from "@/components/tenant-branding-provider";

const maxImageBytes = 300 * 1024;
const maxImageWidth = 600;

function isAllowedImage(file: File, kind: "signature" | "stamp") {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  return kind === "signature"
    ? ["png", "jpg", "jpeg", "webp"].includes(extension ?? "")
    : ["png", "webp"].includes(extension ?? "");
}

async function prepareImage(file: File): Promise<string> {
  const image = new Image();
  const sourceUrl = URL.createObjectURL(file);
  try {
    image.src = sourceUrl;
    await image.decode();
  } catch {
    throw new Error("Could not read the selected image.");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }

  const outputType =
    file.type === "image/jpeg" ? "image/jpeg" : file.type === "image/webp" ? "image/webp" : "image/png";
  let scale = Math.min(1, maxImageWidth / image.naturalWidth);
  let quality = 0.92;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the selected image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL(outputType, quality);
    const encoded = dataUrl.split(",")[1] ?? "";
    const estimatedBytes = Math.floor((encoded.length * 3) / 4);
    if (estimatedBytes <= maxImageBytes) return dataUrl;
    scale *= 0.82;
    if (outputType !== "image/png") quality = Math.max(0.55, quality - 0.08);
  }
  throw new Error("Image is too large to store after resizing. Choose a smaller image.");
}

type SettingsResponse = { report_customization_settings?: Partial<ReportCustomizationSettings> };

function mergeSettings(
  value: Partial<ReportCustomizationSettings> | undefined,
): ReportCustomizationSettings {
  return { ...defaultReportCustomizationSettings, ...value };
}

export function ReportCustomizationSettingsPanel() {
  const branding = useTenantBranding();
  const [settings, setSettings] = useState(defaultReportCustomizationSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchWithNeonAuth(
      `/api/school/report-settings?tenant=${encodeURIComponent(branding.subdomain)}`,
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | (SettingsResponse & { error?: string })
          | null;
        if (!response.ok)
          throw new Error(payload?.error ?? "Could not load report customization settings.");
        if (!cancelled) setSettings(mergeSettings(payload?.report_customization_settings));
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load report settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branding.subdomain]);

  function update<K extends keyof ReportCustomizationSettings>(
    key: K,
    value: ReportCustomizationSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  }

  async function uploadImage(file: File, kind: "signature" | "stamp") {
    if (!isAllowedImage(file, kind)) {
      setError(
        kind === "signature"
          ? "Choose a PNG, JPG, or WebP signature image."
          : "Choose a transparent PNG or WebP stamp image.",
      );
      return;
    }
    setError("");
    setNotice("");
    try {
      const dataUrl = await prepareImage(file);
      update(kind === "signature" ? "headteacher_signature_url" : "official_stamp_url", dataUrl);
      setNotice(`${kind === "signature" ? "Signature" : "School stamp"} preview updated. Save to apply it.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare this image.");
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchWithNeonAuth(
        `/api/school/report-settings?tenant=${encodeURIComponent(branding.subdomain)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(settings),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | (SettingsResponse & { error?: string })
        | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Could not save report customization settings.");
      const saved = mergeSettings(payload?.report_customization_settings);
      setSettings(saved);
      window.dispatchEvent(new Event("report-customization-settings-updated"));
      setNotice("Report customization settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save report settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-panel mt-6 rounded-lg p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h3 className="font-display text-lg font-bold">Report policies & official assets</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the academic details, dates, and security options shown on reports for{" "}
            {branding.schoolName}.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={loading || saving}>
          {saving ? "Saving…" : "Save report settings"}
        </Button>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading report settings…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-md border border-border p-4">
              <h4 className="font-semibold">Grading & benchmarks</h4>
              <label className="grid gap-2 text-sm font-medium">
                Grading scale
                <select
                  value={settings.grading_scale}
                  onChange={(event) =>
                    update(
                      "grading_scale",
                      event.target.value as ReportCustomizationSettings["grading_scale"],
                    )
                  }
                  className="h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="nacca_standard">NaCCA standard · 50% SBA + 50% exam</option>
                  <option value="traditional_30_70">Traditional · 30% continuous + 70% exam</option>
                  <option value="traditional_40_60">Traditional · 40% continuous + 60% exam</option>
                </select>
              </label>
              <SettingToggle
                label="Show class position"
                checked={settings.show_class_position}
                onChange={(checked) => update("show_class_position", checked)}
              />
              <SettingToggle
                label="Show subject statistics"
                checked={settings.show_subject_statistics}
                onChange={(checked) => update("show_subject_statistics", checked)}
              />
              <SettingToggle
                label="Append next-term bill slip"
                checked={settings.append_bill_slip}
                onChange={(checked) => update("append_bill_slip", checked)}
              />
            </section>

            <section className="space-y-4 rounded-md border border-border p-4">
              <h4 className="font-semibold">Term dates & announcement</h4>
              <label className="grid gap-2 text-sm font-medium">
                Next-term resumption date
                <input
                  type="date"
                  value={settings.next_term_resumption_date ?? ""}
                  onChange={(event) =>
                    update("next_term_resumption_date", event.target.value || null)
                  }
                  className="h-10 rounded-md border border-input bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Vacation / closing date
                <input
                  type="date"
                  value={settings.vacation_date ?? ""}
                  onChange={(event) => update("vacation_date", event.target.value || null)}
                  className="h-10 rounded-md border border-input bg-background px-3"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                General announcement
                <textarea
                  maxLength={3000}
                  rows={4}
                  value={settings.general_announcement}
                  onChange={(event) => update("general_announcement", event.target.value)}
                  className="resize-y rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
            </section>

            <section className="space-y-4 rounded-md border border-border p-4">
              <h4 className="font-semibold">Security & delivery</h4>
              <SettingToggle
                label="Enable QR report verification"
                checked={settings.enable_qr_verification}
                onChange={(checked) => update("enable_qr_verification", checked)}
              />
              <SettingToggle
                label="Include report serial number"
                checked={settings.include_serial_number}
                onChange={(checked) => update("include_serial_number", checked)}
              />
              <SettingToggle
                label="Withhold reports when term fees are unpaid"
                checked={settings.withhold_unpaid_reports}
                onChange={(checked) => update("withhold_unpaid_reports", checked)}
              />
            </section>

            <section className="space-y-4 rounded-md border border-border p-4 lg:col-span-2">
              <div>
                <h4 className="font-semibold">Official signatures & school stamp</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Images are resized to at most 600px wide and 300KB before storage. They are only
                  returned to signed-in school portal users.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <ImageUpload
                  title="Headteacher digital signature"
                  accept=".png,.jpg,.jpeg,.webp"
                  value={settings.headteacher_signature_url}
                  kind="signature"
                  onUpload={(file) => void uploadImage(file, "signature")}
                  onRemove={() => update("headteacher_signature_url", null)}
                />
                <ImageUpload
                  title="Official circular school rubber stamp"
                  accept=".png,.webp"
                  value={settings.official_stamp_url}
                  kind="stamp"
                  onUpload={(file) => void uploadImage(file, "stamp")}
                  onRemove={() => update("official_stamp_url", null)}
                />
              </div>
            </section>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-primary">{notice}</p>}
    </section>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function ImageUpload({
  title,
  accept,
  value,
  kind,
  onUpload,
  onRemove,
}: {
  title: string;
  accept: string;
  value: string | null;
  kind: "signature" | "stamp";
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(file: File | undefined) {
    if (file) onUpload(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <div className="rounded-md border border-dashed border-border p-4">
      <h5 className="text-sm font-medium">{title}</h5>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground transition ${dragging ? "border-primary bg-secondary/40" : ""}`}
      >
        {value ? (
          kind === "signature" ? (
            <div className="flex h-24 w-full max-w-sm items-end justify-center border-b border-foreground/60 pb-1">
              <img src={value} alt="Headteacher signature preview" className="max-h-20 max-w-full object-contain" />
            </div>
          ) : (
            <div className="grid size-24 place-items-center overflow-hidden rounded-full border border-primary/40 bg-background">
              <img src={value} alt="School stamp preview" className="size-full object-contain opacity-75" />
            </div>
          )
        ) : (
          <>
            <ImagePlus className="size-6" />
            <span>Drag an image here or tap to choose</span>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={onChange} />
      </label>
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
