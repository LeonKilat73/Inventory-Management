import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by a Supabase Database Webhook (insert on `notifications`) once one
// is configured -- see API.md "Webhooks" section. Not reachable from
// Supabase's cloud infrastructure while this app only runs on
// localhost/no public URL, so this route can't be end-to-end tested until
// deployed somewhere with one. It no-ops (logs instead of sending) whenever
// RESEND_API_KEY isn't set, so the rest of the pipeline (preference check,
// email_sent_at stamping) is still exercisable by calling it directly.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.NOTIFICATIONS_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const notification = payload?.record;
  if (!notification?.id || !notification?.user_id) {
    return Response.json({ error: "Invalid payload -- expected a Supabase Database Webhook insert event." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_enabled")
    .eq("user_id", notification.user_id)
    .single();

  if (!prefs?.email_enabled) {
    return Response.json({ skipped: "email not enabled for this user" });
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[notifications-dispatch] would email notification ${notification.id} to user ${notification.user_id}: "${notification.title}"`,
    );
    return Response.json({ skipped: "no email provider configured (RESEND_API_KEY unset)" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", notification.user_id)
    .single();

  if (!profile?.email) {
    return Response.json({ error: "Recipient has no email on file." }, { status: 404 });
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "notifications@example.com",
      to: profile.email,
      subject: notification.title,
      text: notification.body || notification.title,
    }),
  });

  if (!emailRes.ok) {
    const text = await emailRes.text();
    return Response.json({ error: `Email provider error: ${text}` }, { status: 502 });
  }

  await supabase
    .from("notifications")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", notification.id);

  return Response.json({ sent: true });
}
