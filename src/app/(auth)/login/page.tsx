"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, signUp, requestPasswordReset, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [signInState, signInAction, signInPending] = useActionState(
    login,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );
  const [forgotState, forgotAction, forgotPending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  const titles = {
    "sign-in": "Sign in",
    "sign-up": "Create the first admin account",
    "forgot-password": "Reset your password",
  };

  return (
    <Card>
      <h1 className="text-xl font-medium text-on-surface">{titles[mode]}</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Car accessories inventory system
      </p>

      {mode === "sign-in" && (
        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <TextField
            label="Email or Username"
            name="identifier"
            type="text"
            autoComplete="username"
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {signInState.error && <ErrorText>{signInState.error}</ErrorText>}
          <Button type="submit" disabled={signInPending} className="w-full">
            {signInPending ? "Please wait…" : "Sign in"}
          </Button>
        </form>
      )}

      {mode === "sign-up" && (
        <form action={signUpAction} className="mt-6 space-y-4">
          <TextField label="Full name" name="fullName" type="text" autoComplete="name" required />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField
            label="Username"
            name="username"
            type="text"
            autoComplete="username"
            pattern="[a-z0-9_.]{3,32}"
            title="3-32 characters: lowercase letters, numbers, underscore, or period"
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          {signUpState.error && <ErrorText>{signUpState.error}</ErrorText>}
          <Button type="submit" disabled={signUpPending} className="w-full">
            {signUpPending ? "Please wait…" : "Create account"}
          </Button>
        </form>
      )}

      {mode === "forgot-password" && (
        <form action={forgotAction} className="mt-6 space-y-4">
          <TextField label="Email or Username" name="identifier" type="text" autoComplete="username" required />
          {forgotState.error && <ErrorText>{forgotState.error}</ErrorText>}
          {forgotState.info && <p className="text-sm text-tertiary">{forgotState.info}</p>}
          <Button type="submit" disabled={forgotPending} className="w-full">
            {forgotPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <div className="mt-4 flex flex-col items-start gap-2">
        {mode === "sign-in" && (
          <button
            type="button"
            onClick={() => setMode("forgot-password")}
            className="text-sm text-primary underline underline-offset-2 hover:text-on-surface"
          >
            Forgot password?
          </button>
        )}
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="text-sm text-primary underline underline-offset-2 hover:text-on-surface"
        >
          {mode === "sign-up"
            ? "Already have an account? Sign in"
            : mode === "forgot-password"
              ? "Back to sign in"
              : "First time setting this up? Create the admin account"}
        </button>
      </div>
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-error">{children}</p>;
}
