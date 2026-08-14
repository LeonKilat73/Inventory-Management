"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/getSiteOrigin";

export type AuthActionState = { error: string | null; info?: string | null };

const LOCK_MINUTES = 5;
const SUSPEND_MESSAGE =
  'This account has been suspended after repeated failed sign-ins. Use "Forgot password?" below to reset it, then ask a manager or admin to reactivate the account.';

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "") || "/dashboard";

  if (!identifier || !password) {
    return { error: "Email/username and password are required." };
  }

  // Resolved and lockout-checked via the service-role client, before any
  // Supabase Auth call -- there's no session yet to enforce this through
  // RLS, and we don't want to spend an auth attempt against an account
  // that's already locked or suspended.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, is_active, is_suspended, admin_locked, locked_until")
    .or(`email.eq.${identifier},username.eq.${identifier}`)
    .maybeSingle();

  if (!profile) {
    return { error: "Invalid email/username or password." };
  }
  if (!profile.is_active) {
    return { error: "This account has been deactivated. Contact a manager or admin." };
  }
  if (profile.is_suspended) {
    return { error: SUSPEND_MESSAGE };
  }
  if (profile.admin_locked) {
    return { error: "This account has been locked by an admin. Contact a manager or admin to unlock it." };
  }
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000),
    );
    return {
      error: `Too many failed attempts. This account is temporarily locked -- try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password });

  if (error) {
    const { data: result } = await admin.rpc("fn_register_failed_login", { p_user_id: profile.id });
    const state = result?.[0];
    const failedCount = state?.out_failed_login_count ?? 0;

    if (state?.out_is_suspended) {
      return { error: SUSPEND_MESSAGE };
    }
    // fn_register_failed_login only sets locked_until when the count hits
    // exactly 5 -- outside of that it just echoes back whatever was already
    // there (which may be a stale, already-expired timestamp from a prior
    // lock), so failedCount === 5 is the real "just got locked" signal, not
    // merely out_locked_until being non-null.
    if (failedCount === 5) {
      return {
        error: `Too many failed attempts. This account is temporarily locked for ${LOCK_MINUTES} minutes.`,
      };
    }
    const remaining = failedCount < 5 ? 5 - failedCount : Math.max(0, 7 - failedCount);
    return {
      error: `Invalid email/username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before this account is ${failedCount < 5 ? "temporarily locked" : "suspended"}.`,
    };
  }

  // Successful sign-in clears the slate, including any residual count left
  // over from a prior temporary lock.
  await admin
    .from("profiles")
    .update({ failed_login_count: 0, locked_until: null })
    .eq("id", profile.id);

  redirect(redirectTo);
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  if (!identifier) return { error: "Enter your email or username." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .or(`email.eq.${identifier},username.eq.${identifier}`)
    .maybeSingle();

  if (profile?.email) {
    const origin = await getSiteOrigin();
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
  }

  // Same message whether or not an account was found, so this can't be used
  // to check which emails/usernames are registered.
  return {
    error: null,
    info: "If an account exists for that email or username, a password reset link has been sent.",
  };
}

const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !username || !password) {
    return { error: "Name, email, username, and password are required." };
  }
  if (!USERNAME_RE.test(username)) {
    return { error: "Username must be 3-32 characters: lowercase letters, numbers, underscore, or period." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Public self-signup only exists to bootstrap the very first admin
  // account (there's no admin yet to invite anyone). Once any account
  // exists, this closes -- everyone else comes in through an admin invite
  // (see src/actions/users.ts inviteUser), which is what actually enforces
  // "admin controls who gets access."
  const admin = createAdminClient();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    return { error: "Self-signup is disabled. Ask an admin to invite you." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const { error: usernameError } = await admin
      .from("profiles")
      .update({ username })
      .eq("id", data.user.id);
    if (usernameError) {
      return {
        error: usernameError.code === "23505" ? "That username is already taken." : usernameError.message,
      };
    }
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Lands here via /auth/callback after an invite (or, later, a
// forgot-password) email link exchanges its code for a session -- the user
// is already authenticated at this point, just needs to pick a password.
export async function setNewPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Clears the "must reset before an admin can unsuspend" flag set at the
  // 7th failed attempt. The account itself stays suspended until a
  // manager/admin explicitly reactivates it (src/actions/users.ts
  // unsuspendUser) -- resetting the password alone doesn't let them back in.
  if (data.user) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ password_reset_required: false }).eq("id", data.user.id);
  }

  redirect("/dashboard");
}
