"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ImportSourceSystem, ImportEntityType, ImportPreview, ImportHistorySummary } from "@club/shared";
import { TARGET_FIELDS } from "@/lib/migration/field-mapper";

type Tab = "import" | "history";
type Step = "configure" | "upload" | "preview" | "mapping" | "importing" | "complete";

export default function MigrationPage() {
  const [tab, setTab] = useState<Tab>("import");
  const [history, setHistory] = useState<ImportHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/migration");
      if (res.status === 403) { setError("admin"); return; }
      if (!res.ok) throw new Error();
      setHistory(await res.json());
    } catch {
      setError("Failed to load migration data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <LoadingSkeleton />;
  if (error === "admin") return <NoAccess />;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Data Migration</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Import members, billing, and events from Jonas, Northstar, or CSV files
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {([
          { key: "import" as Tab, label: "Import Data" },
          { key: "history" as Tab, label: "Import History" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "import" && <ImportWizard onComplete={fetchHistory} />}
      {tab === "history" && history && <HistoryTab data={history} />}
    </div>
  );
}

/* ─── Import Wizard ─── */
function ImportWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>("configure");
  const [sourceSystem, setSourceSystem] = useState<ImportSourceSystem>("generic_csv");
  const [entityType, setEntityType] = useState<ImportEntityType>("members");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [csvContent, setCsvContent] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sources: { value: ImportSourceSystem; label: string; desc: string }[] = [
    { value: "jonas", label: "Jonas Club Software", desc: "Export from Jonas member management" },
    { value: "northstar", label: "Northstar Club Management", desc: "Export from Northstar CRM" },
    { value: "clubessential", label: "Clubessential", desc: "Export from Clubessential platform" },
    { value: "generic_csv", label: "Generic CSV", desc: "Standard CSV with column headers" },
  ];

  const entities: { value: ImportEntityType; label: string; desc: string }[] = [
    { value: "members", label: "Members", desc: "Member profiles, tiers, and contact info" },
    { value: "invoices", label: "Invoices", desc: "Billing invoices and charges" },
    { value: "payments", label: "Payments", desc: "Payment history and transactions" },
    { value: "events", label: "Events", desc: "Club events and activities" },
  ];

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Read file for later re-use
      const content = await file.text();
      setCsvContent(content);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_system", sourceSystem);
      formData.append("entity_type", entityType);

      const res = await fetch("/api/migration/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Upload failed");
        return;
      }

      const data: ImportPreview = await res.json();
      setPreview(data);
      setMapping(data.suggested_mapping);
      setStep("preview");
    } finally {
      setUploading(false);
    }
  }

  async function handleExecute() {
    if (!preview) return;
    setImporting(true);
    setStep("importing");

    try {
      const res = await fetch("/api/migration/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: preview.batch_id,
          mapping,
          csv_content: csvContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Import failed");
        setStep("mapping");
        return;
      }

      const data = await res.json();
      setResult(data);
      setStep("complete");
      onComplete();
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("configure");
    setPreview(null);
    setMapping({});
    setCsvContent("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs">
        {(["configure", "upload", "preview", "mapping", "complete"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-[var(--border)]" />}
            <span className={`rounded-full px-3 py-1 font-medium ${
              step === s
                ? "bg-[var(--primary)] text-white"
                : ["configure", "upload", "preview", "mapping", "importing", "complete"].indexOf(step) >
                  ["configure", "upload", "preview", "mapping", "importing", "complete"].indexOf(s)
                ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}>
              {s === "configure" ? "1. Configure" : s === "upload" ? "2. Upload" : s === "preview" ? "3. Preview" : s === "mapping" ? "4. Map Fields" : "5. Done"}
            </span>
          </div>
        ))}
      </div>

      {/* Step: Configure */}
      {step === "configure" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="text-sm font-semibold mb-3">Source System</h3>
            <div className="grid grid-cols-2 gap-3">
              {sources.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSourceSystem(s.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    sourceSystem === s.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="text-sm font-semibold mb-3">Data Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {entities.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setEntityType(e.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    entityType === e.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{e.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep("upload")}
            className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Next: Upload File
          </button>
        </div>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-8 text-center">
            <p className="text-sm font-medium mb-2">Upload CSV File</p>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Supported: .csv files exported from {sources.find((s) => s.value === sourceSystem)?.label}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="text-sm"
            />
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Required fields for {entityType}:</strong>{" "}
              {TARGET_FIELDS[entityType].filter((f) => f.required).map((f) => f.label).join(", ")}
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("configure")} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
              Back
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Parsing..." : "Upload & Preview"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs text-[var(--muted-foreground)]">Total Rows</p>
              <p className="text-2xl font-bold">{preview.total_rows}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs text-[var(--muted-foreground)]">Valid</p>
              <p className="text-2xl font-bold text-[var(--primary)]">{preview.valid_rows}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs text-[var(--muted-foreground)]">Errors</p>
              <p className={`text-2xl font-bold ${preview.error_rows > 0 ? "text-red-500" : ""}`}>{preview.error_rows}</p>
            </div>
          </div>

          {/* Sample data */}
          <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--muted)]">
                <tr>
                  {preview.detected_columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {preview.sample_rows.map((row, i) => (
                  <tr key={i}>
                    {preview.detected_columns.map((col) => (
                      <td key={col} className="px-3 py-1.5 whitespace-nowrap">{String(row[col] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                Validation Errors ({preview.errors.length})
              </p>
              {preview.errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">
                  Row {err.row}: {err.message}
                </p>
              ))}
              {preview.errors.length > 10 && (
                <p className="text-xs text-red-500 mt-1">...and {preview.errors.length - 10} more</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
              Start Over
            </button>
            <button
              onClick={() => setStep("mapping")}
              className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Next: Review Field Mapping
            </button>
          </div>
        </div>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && preview && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="text-sm font-semibold mb-3">Field Mapping</h3>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              Map your CSV columns to ClubOS fields. Auto-detected mappings are pre-filled.
            </p>
            <div className="space-y-2">
              {preview.detected_columns.map((col) => (
                <div key={col} className="flex items-center gap-3">
                  <span className="w-40 text-sm font-mono truncate">{col}</span>
                  <span className="text-[var(--muted-foreground)]">→</span>
                  <select
                    value={mapping[col] || ""}
                    onChange={(e) => setMapping({ ...mapping, [col]: e.target.value })}
                    className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                  >
                    <option value="">— Skip this column —</option>
                    {TARGET_FIELDS[entityType].map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label} {f.required ? "*" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("preview")} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
              Back
            </button>
            <button
              onClick={handleExecute}
              disabled={importing}
              className="rounded-lg bg-[var(--primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {importing ? "Importing..." : `Import ${preview.valid_rows} Records`}
            </button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-8 text-center">
          <div className="h-8 w-8 mx-auto mb-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm font-medium">Importing data...</p>
          <p className="text-xs text-[var(--muted-foreground)]">This may take a moment for large files.</p>
        </div>
      )}

      {/* Step: Complete */}
      {step === "complete" && result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--primary)] bg-[var(--primary)]/5 p-6 text-center">
            <p className="text-lg font-bold text-[var(--primary)] mb-2">Import Complete</p>
            <div className="flex justify-center gap-8">
              <div>
                <p className="text-2xl font-bold">{result.imported}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Imported</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{result.skipped}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Skipped</p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Warnings</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-amber-600">{err}</p>
              ))}
            </div>
          )}

          <button
            onClick={reset}
            className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Import More Data
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── History Tab ─── */
function HistoryTab({ data }: { data: ImportHistorySummary }) {
  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    preview: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    importing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Total Imports</p>
          <p className="text-2xl font-bold">{data.stats.totalImports}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Members Imported</p>
          <p className="text-2xl font-bold">{data.stats.totalMembersImported}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Invoices Imported</p>
          <p className="text-2xl font-bold">{data.stats.totalInvoicesImported}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Last Import</p>
          <p className="text-sm font-bold">
            {data.stats.lastImportDate
              ? new Date(data.stats.lastImportDate).toLocaleDateString()
              : "Never"}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Source</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">File</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Rows</th>
              <th className="px-4 py-2 text-right font-medium">Imported</th>
              <th className="px-4 py-2 text-right font-medium">Skipped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.recentImports.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No imports yet. Use the Import Data tab to get started.
                </td>
              </tr>
            ) : (
              data.recentImports.map((b) => (
                <tr key={b.id} className="hover:bg-[var(--muted)]/50">
                  <td className="px-4 py-2">{new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 capitalize">{b.source_system.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 capitalize">{b.entity_type}</td>
                  <td className="px-4 py-2 font-mono text-xs truncate max-w-32">{b.file_name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[b.status] ?? ""}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{b.total_rows}</td>
                  <td className="px-4 py-2 text-right text-[var(--primary)] font-medium">{b.imported_rows}</td>
                  <td className="px-4 py-2 text-right text-[var(--muted-foreground)]">{b.skipped_rows}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Loading / No Access ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--muted)]" />
      <div className="h-4 w-96 animate-pulse rounded bg-[var(--muted)]" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <p className="text-lg font-semibold">Admin Access Required</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Data migration tools are available to club administrators only.
      </p>
    </div>
  );
}
