"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { receivePurchaseOrderLine } from "@/actions/purchaseOrders";
import { Card } from "@/components/ui/Card";

type Line = { id: string; sku: string; name: string; remaining: number };

// A USB/Bluetooth barcode scanner behaves like a keyboard: it types the
// scanned code into whatever's focused, then sends Enter. No camera or
// scanning library needed -- just a text input that's kept focused and
// treats Enter as "look this SKU up and receive one unit," so a worker can
// scan a whole box of arrivals without touching the mouse or keyboard.
// Matches against this PO's own lines only; the existing per-line form
// below still covers manual entry, corrections, and receiving more than
// one unit at a time.
export function ScanToReceive({ poId, lines }: { poId: string; lines: Line[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleScan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = inputRef.current?.value.trim();
    if (!code || pending) return;

    const line = lines.find((l) => l.sku.toLowerCase() === code.toLowerCase());
    if (!line) {
      setStatus({ ok: false, message: `No line on this PO matches "${code}".` });
    } else if (line.remaining <= 0) {
      setStatus({ ok: false, message: `${line.name} is already fully received.` });
    } else {
      setPending(true);
      const formData = new FormData();
      formData.set("poId", poId);
      formData.set("lineId", line.id);
      formData.set("quantity", "1");
      const result = await receivePurchaseOrderLine({ error: null }, formData);
      if (result.error) {
        setStatus({ ok: false, message: result.error });
      } else {
        const left = line.remaining - 1;
        setStatus({ ok: true, message: `Received 1 × ${line.name}${left > 0 ? ` — ${left} left` : " — fully received"}` });
        router.refresh();
      }
      setPending(false);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-medium text-on-surface">Scan to receive</h2>
      <form onSubmit={handleScan} className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          autoFocus
          disabled={pending}
          placeholder="Scan or type a SKU, then Enter…"
          className="w-full max-w-xs rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        {status && (
          <span className={`text-sm ${status.ok ? "text-primary" : "text-error"}`}>{status.message}</span>
        )}
      </form>
      <p className="mt-2 text-xs text-on-surface-variant">
        Each scan receives one unit of that item. Works with any USB or Bluetooth barcode scanner set up as a
        keyboard — no app pairing needed.
      </p>
    </Card>
  );
}
