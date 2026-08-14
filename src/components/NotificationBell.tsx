"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase
      .from("notifications")
      .select("id, title, body, type, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (active && data) setNotifications(data);
      });

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        },
      )
      .on(
        // Keeps the badge count in sync when a notification is marked read
        // from elsewhere (the /notifications page, another tab, etc.) --
        // otherwise this component's own state only ever reflects its
        // initial fetch plus new inserts.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-sidebar-foreground hover:bg-sidebar-hover"
      >
        <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor" className="h-4.5 w-4.5">
          <path
            d="M5 8.3a5 5 0 0 1 10 0c0 3.6 1.3 5 1.3 5H3.7S5 11.9 5 8.3Z"
            strokeLinejoin="round"
          />
          <path d="M8.3 16a1.7 1.7 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-medium text-on-error">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-2 shadow-lg">
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-3 py-4 text-sm text-on-surface-variant">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-container ${
                  n.is_read ? "text-on-surface-variant" : "text-on-surface"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className="font-medium">{n.title}</span>
                </div>
                {n.body && <p className="mt-0.5 text-xs text-on-surface-variant">{n.body}</p>}
              </button>
            ))}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-3 py-2 text-center text-sm text-primary hover:bg-surface-container"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
