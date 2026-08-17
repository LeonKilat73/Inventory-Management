"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/actions/auth";
import { Button } from "./ui/Button";

const IDLE_MS = 5 * 60 * 1000; // no activity for this long -> show the warning
const GRACE_MS = 60 * 1000; // time to dismiss the warning before auto sign-out
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

// Mounted once in the authenticated (app) layout. Tracks real user activity
// (not just page loads) so a signed-in tab left open and untouched signs
// itself out after IDLE_MS + GRACE_MS, redirecting to /login via the
// existing signOut server action.
export function IdleSessionGuard() {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(GRACE_MS / 1000);
  const warningRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResetAt = useRef(0);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (graceTimer.current) clearTimeout(graceTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }, []);

  const startIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      warningRef.current = true;
      setWarning(true);
      setSecondsLeft(GRACE_MS / 1000);
      countdownInterval.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
      graceTimer.current = setTimeout(() => {
        void signOut();
      }, GRACE_MS);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    startIdleTimer();

    // Real user activity resets the idle clock -- ignored once the warning
    // is already showing, so background activity (e.g. a stray scroll)
    // can't silently dismiss it; only the explicit button below can.
    function handleActivity() {
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastResetAt.current < 1000) return; // throttle: at most once/sec
      lastResetAt.current = now;
      startIdleTimer();
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [startIdleTimer, clearTimers]);

  function staySignedIn() {
    warningRef.current = false;
    clearTimers();
    setWarning(false);
    startIdleTimer();
  }

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-6 shadow-lg">
        <h2 className="text-lg font-medium text-on-surface">Still there?</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          You&apos;ve been inactive for a while. For security, you&apos;ll be signed out in{" "}
          <span className="font-medium text-on-surface">{secondsLeft}s</span>.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={staySignedIn}>Stay signed in</Button>
        </div>
      </div>
    </div>
  );
}
