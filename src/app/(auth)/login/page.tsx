"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, signUp, type AuthActionState } from "@/actions/auth";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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

  return (
    <div className="rounded-lg border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-foreground">
        {mode === "sign-in" ? "Sign in" : "Create the first admin account"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Car accessories inventory system
      </p>

      {mode === "sign-in" ? (
        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
          {signInState.error && <ErrorText>{signInState.error}</ErrorText>}
          <SubmitButton pending={signInPending}>Sign in</SubmitButton>
        </form>
      ) : (
        <form action={signUpAction} className="mt-6 space-y-4">
          <Field label="Full name" name="fullName" type="text" autoComplete="name" />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
          />
          {signUpState.error && <ErrorText>{signUpState.error}</ErrorText>}
          <SubmitButton pending={signUpPending}>Create account</SubmitButton>
        </form>
      )}

      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        className="mt-4 text-sm text-zinc-500 underline underline-offset-2 hover:text-foreground"
      >
        {mode === "sign-in"
          ? "First time setting this up? Create the admin account"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{props.label}</span>
      <input
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        required
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground dark:border-white/20"
      />
    </label>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-600 dark:text-red-400">{children}</p>;
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
