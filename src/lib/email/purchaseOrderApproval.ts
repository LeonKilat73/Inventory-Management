import "server-only";

export type ApprovalEmailResult = { sent: true } | { sent: false; reason: string };

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Plain fetch to Resend, same provider the app's password-reset emails use.
// Never throws: a failed email must not undo a purchase order that was
// created fine -- the caller shows the result and the approver is also
// notified in-app regardless.
//
// While RESEND_FROM_EMAIL is still Resend's shared onboarding@resend.dev
// sender, Resend only delivers to the account owner's own address and
// refuses everyone else. That comes back here as a not-sent result, and goes
// away on its own once a verified domain is set as the sender.
export async function sendPurchaseOrderApprovalEmail(args: {
  to: string;
  poNumber: string;
  supplierName: string | null;
  requesterName: string;
  link: string;
}): Promise<ApprovalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "Email isn't set up on this server." };

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const subject = `Approval needed: purchase order ${args.poNumber}`;
  const supplierLine = args.supplierName ? ` to ${args.supplierName}` : "";

  const text = [
    `${args.requesterName} created purchase order ${args.poNumber}${supplierLine} and sent it to you for approval.`,
    "",
    "Sign in and open it here to approve or reject it:",
    args.link,
  ].join("\n");

  const html = `<p>${escapeHtml(args.requesterName)} created purchase order <strong>${escapeHtml(args.poNumber)}</strong>${escapeHtml(supplierLine)} and sent it to you for approval.</p>
<p><a href="${escapeHtml(args.link)}">Open the purchase order</a> (you'll be asked to sign in first), then choose Approve or Reject.</p>
<p style="color:#666;font-size:12px">If the button doesn't work, copy this link: ${escapeHtml(args.link)}</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: args.to, subject, text, html }),
    });
    if (res.ok) return { sent: true };

    const body = await res.json().catch(() => ({}));
    console.error("Approval email not sent:", res.status, JSON.stringify(body));
    return { sent: false, reason: typeof body?.message === "string" ? body.message : `Email provider error (${res.status}).` };
  } catch (err) {
    console.error("Approval email request failed:", err instanceof Error ? err.message : err);
    return { sent: false, reason: "Couldn't reach the email provider." };
  }
}
