import "server-only";

type Column<T> = { key: keyof T; header: string };

// Excel/Sheets run any text cell that starts with = + - @ (or a tab/CR) as a
// formula, so an item or supplier named `=HYPERLINK(...)` would execute when
// the export is opened. A leading apostrophe makes it plain text. Real numbers
// (including negative ones like a -3 stock movement) are left alone.
function neutralizeFormula(str: string): string {
  if (/^-?\d+(\.\d+)?$/.test(str)) return str;
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

function escapeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const str = typeof value === "string" ? neutralizeFormula(raw) : raw;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const header = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(","));
  // Leading BOM so Excel (the realistic target for a shop's export) opens
  // it as UTF-8 instead of guessing the system codepage and mangling the
  // peso sign or any accented supplier/customer names.
  return "﻿" + [header, ...lines].join("\r\n");
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
