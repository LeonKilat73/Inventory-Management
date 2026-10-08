// Reads a spreadsheet exported as CSV and pulls out SKU / price / cost. Meant
// for the Items export round trip (SKU, Unit Cost, Unit Price columns) but
// forgiving about what Excel produces: a BOM, quoted cells, CRLF, semicolon
// separators in some regional settings, and prices written like "₱1,200.50".

export type PriceRow = { sku: string; price?: string; cost?: string };
export type ParsedPriceCsv = { rows: PriceRow[]; error: string | null; usedColumns: string[] };

function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((c) => c.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  record.push(field);
  if (record.some((c) => c.trim() !== "")) records.push(record);
  return records;
}

const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const SKU_HEADERS = new Set(["sku", "itemsku", "code", "itemcode"]);
const PRICE_HEADERS = new Set(["unitprice", "price", "sellingprice", "newprice", "retailprice"]);
const COST_HEADERS = new Set(["unitcost", "cost", "newcost", "purchasecost"]);

// Strips currency symbols, thousands separators and spaces, so "₱1,200.50"
// reaches the database as 1200.50. Anything else left over (letters) is
// passed through untouched and rejected there as "isn't a number".
const cleanNumber = (v: string) => v.replace(/[₱$,\s]/g, "");

export function parsePriceCsv(rawText: string): ParsedPriceCsv {
  const text = rawText.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";

  const records = splitRecords(text, delimiter);
  if (records.length < 2) {
    return { rows: [], error: "That file has no data rows. It needs a header row and at least one item.", usedColumns: [] };
  }

  const headers = records[0].map(normalize);
  const skuCol = headers.findIndex((h) => SKU_HEADERS.has(h));
  const priceCol = headers.findIndex((h) => PRICE_HEADERS.has(h));
  const costCol = headers.findIndex((h) => COST_HEADERS.has(h));

  if (skuCol === -1) {
    return { rows: [], error: 'No "SKU" column found. The first row must be headings, including SKU.', usedColumns: [] };
  }
  if (priceCol === -1 && costCol === -1) {
    return { rows: [], error: 'No "Unit Price" (or "Price") or "Unit Cost" column found.', usedColumns: [] };
  }

  const rows: PriceRow[] = [];
  for (const rec of records.slice(1)) {
    const row: PriceRow = { sku: (rec[skuCol] ?? "").trim() };
    if (priceCol !== -1) row.price = cleanNumber(rec[priceCol] ?? "");
    if (costCol !== -1) row.cost = cleanNumber(rec[costCol] ?? "");
    rows.push(row);
  }

  const usedColumns = ["SKU", ...(priceCol !== -1 ? ["price"] : []), ...(costCol !== -1 ? ["cost"] : [])];
  return { rows, error: null, usedColumns };
}
