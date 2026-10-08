"use client";

import { useState } from "react";
import Link from "next/link";
import { importItemPrices, type PriceImportResult } from "@/actions/itemPrices";
import { parsePriceCsv, type PriceRow } from "@/lib/parsePriceCsv";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const money = (n: number | null) => (n === null ? "none" : `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

type Stage = "empty" | "read" | "checked" | "applied";

export function PriceImport() {
  const [stage, setStage] = useState<Stage>("empty");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [result, setResult] = useState<PriceImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setError(null);
    if (!file) {
      setStage("empty");
      return;
    }
    setFileName(file.name);
    const parsed = parsePriceCsv(await file.text());
    if (parsed.error) {
      setError(parsed.error);
      setRows([]);
      setStage("empty");
      return;
    }
    setRows(parsed.rows);
    setColumns(parsed.usedColumns);
    setStage("read");
  }

  async function run(apply: boolean) {
    setPending(true);
    setError(null);
    const res = await importItemPrices(rows, apply);
    setPending(false);
    if (res.error || !res.result) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setResult(res.result);
    setStage(apply ? "applied" : "checked");
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-3xl">
        <h2 className="mb-1 text-lg font-medium text-on-surface">1. Choose your file</h2>
        <p className="mb-4 text-sm text-on-surface-variant">
          A CSV with a SKU column and a Unit Price and/or Unit Cost column. The Items export already has them in the
          right shape.
        </p>
        <input
          id="price-file"
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block w-full text-sm text-on-surface file:mr-4 file:rounded-full file:border-0 file:bg-secondary-container file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-secondary-container"
        />
        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        {stage !== "empty" && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <p className="text-sm text-on-surface">
              <span className="font-medium">{rows.length.toLocaleString("en-PH")} rows</span> read from {fileName}
              <span className="text-on-surface-variant"> (using {columns.join(", ")})</span>
            </p>
            {stage === "read" && (
              <Button type="button" onClick={() => run(false)} disabled={pending}>
                {pending ? "Checking…" : "Check the file"}
              </Button>
            )}
          </div>
        )}
      </Card>

      {result && (
        <Card className="max-w-3xl">
          <h2 className="mb-1 text-lg font-medium text-on-surface">
            {stage === "applied" ? "Done" : "2. Review before anything changes"}
          </h2>

          {stage === "applied" ? (
            <p className="mb-4 text-sm text-on-surface">
              Updated <span className="font-medium">{result.updated.toLocaleString("en-PH")}</span>{" "}
              {result.updated === 1 ? "item" : "items"}. Each change is in the audit log under your name.{" "}
              <Link href="/items" className="text-primary underline underline-offset-2">
                View items
              </Link>
            </p>
          ) : (
            <p className="mb-4 text-sm text-on-surface-variant">Nothing has been saved yet.</p>
          )}

          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-on-surface-variant">{stage === "applied" ? "Updated" : "Will change"}</dt>
              <dd className="text-xl font-medium text-on-surface">
                {(stage === "applied" ? result.updated : result.willChange).toLocaleString("en-PH")}
              </dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Already the same</dt>
              <dd className="text-xl font-medium text-on-surface">{result.unchanged.toLocaleString("en-PH")}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">SKU not found</dt>
              <dd className="text-xl font-medium text-on-surface">{result.notFoundCount}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Problems</dt>
              <dd className="text-xl font-medium text-on-surface">{result.invalidCount}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Bundles skipped</dt>
              <dd className="text-xl font-medium text-on-surface">{result.bundlesCount}</dd>
            </div>
          </dl>

          {result.sample.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <p className="mb-2 text-xs text-on-surface-variant">
                {result.sample.length < result.willChange && stage !== "applied"
                  ? `First ${result.sample.length} of ${result.willChange} changes:`
                  : "Changes:"}
              </p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-on-surface-variant">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Item</th>
                    <th className="pb-2 pr-4 font-medium">Price</th>
                    <th className="pb-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sample.map((s) => (
                    <tr key={s.sku} className="border-t border-outline-variant/60">
                      <td className="py-2 pr-4">
                        <p className="text-on-surface">{s.name}</p>
                        <p className="font-mono text-xs text-on-surface-variant">{s.sku}</p>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-on-surface">
                        {s.oldPrice === s.newPrice ? money(s.newPrice) : `${money(s.oldPrice)} → ${money(s.newPrice)}`}
                      </td>
                      <td className="whitespace-nowrap py-2 tabular-nums text-on-surface">
                        {s.oldCost === s.newCost ? money(s.newCost) : `${money(s.oldCost)} → ${money(s.newCost)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.invalidCount > 0 && (
            <details className="mb-3 text-sm">
              <summary className="cursor-pointer text-on-surface">
                {result.invalidCount} row{result.invalidCount === 1 ? "" : "s"} with problems (these are skipped)
              </summary>
              <ul className="mt-2 space-y-1 text-on-surface-variant">
                {result.invalid.map((p) => (
                  <li key={`${p.row}-${p.sku}`}>
                    Row {p.row + 1}
                    {p.sku ? ` (${p.sku})` : ""}: {p.reason}
                  </li>
                ))}
                {result.invalidCount > result.invalid.length && <li>…and {result.invalidCount - result.invalid.length} more</li>}
              </ul>
            </details>
          )}

          {result.notFoundCount > 0 && (
            <details className="mb-3 text-sm">
              <summary className="cursor-pointer text-on-surface">
                {result.notFoundCount} SKU{result.notFoundCount === 1 ? "" : "s"} not found (skipped)
              </summary>
              <p className="mt-2 font-mono text-xs text-on-surface-variant">
                {result.notFound.join(", ")}
                {result.notFoundCount > result.notFound.length ? ` …and ${result.notFoundCount - result.notFound.length} more` : ""}
              </p>
            </details>
          )}

          {result.bundlesCount > 0 && (
            <p className="mb-3 text-sm text-on-surface-variant">
              {result.bundlesCount} bundle{result.bundlesCount === 1 ? " was" : "s were"} skipped: edit bundle prices on the{" "}
              <Link href="/items/bundles" className="text-primary underline underline-offset-2">
                Bundles page
              </Link>
              .
            </p>
          )}

          {stage === "checked" && (
            <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/60 pt-4">
              <Button type="button" onClick={() => run(true)} disabled={pending || result.willChange === 0}>
                {pending ? "Saving…" : `Apply ${result.willChange.toLocaleString("en-PH")} change${result.willChange === 1 ? "" : "s"}`}
              </Button>
              {result.willChange === 0 && <p className="text-sm text-on-surface-variant">Nothing in this file would change anything.</p>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
