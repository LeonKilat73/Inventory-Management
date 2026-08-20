"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

export type NavIcon =
  | "dashboard"
  | "items"
  | "bundles"
  | "suppliers"
  | "purchaseOrders"
  | "stock"
  | "defective"
  | "calendar"
  | "expenses"
  | "reports"
  | "users"
  | "roles"
  | "auditLog"
  | "apiKeys"
  | "quickbooks";
type NavItem = { href: string; label: string; icon: NavIcon };

const icons: Record<NavIcon, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.3" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.3" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.3" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.3" />
    </svg>
  ),
  items: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M10 2.5 17 6.5v7L10 17.5 3 13.5v-7L10 2.5Z" strokeLinejoin="round" />
      <path d="M3 6.5 10 10.5l7-4M10 10.5v7" strokeLinejoin="round" />
    </svg>
  ),
  bundles: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M10 2.5 17.5 7 10 11.5 2.5 7 10 2.5Z" strokeLinejoin="round" />
      <path d="M2.5 10.5 10 15l7.5-4.5M2.5 13.5 10 18l7.5-4.5" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <circle cx="7.2" cy="6.5" r="3" />
      <path d="M1.7 17c.7-3 2.8-4.7 5.5-4.7s4.8 1.7 5.5 4.7" strokeLinecap="round" />
      <circle cx="14.5" cy="7.3" r="2.3" />
      <path d="M13.2 12.5c1.9-.2 3.7 1 4.5 3.6" strokeLinecap="round" />
    </svg>
  ),
  roles: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M10 2 16.5 4.5v5c0 4-2.7 6.9-6.5 8.5-3.8-1.6-6.5-4.5-6.5-8.5v-5L10 2Z" strokeLinejoin="round" />
      <path d="m7.3 10 1.9 1.9 3.5-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  suppliers: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M1.7 5.3h9v8.4h-9z" strokeLinejoin="round" />
      <path d="M10.7 8.3h4l2.6 2.9v2.5h-6.6z" strokeLinejoin="round" />
      <circle cx="5.2" cy="15.7" r="1.5" />
      <circle cx="13.3" cy="15.7" r="1.5" />
    </svg>
  ),
  purchaseOrders: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M6 2.5h8a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M7.5 1.7h5v2h-5zM6.8 8h6.4M6.8 11h6.4M6.8 14h3.5" strokeLinecap="round" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M3.5 16.5v-6M9 16.5v-10M14.5 16.5v-3.5" strokeLinecap="round" />
      <path d="M2.5 16.5h15" strokeLinecap="round" />
    </svg>
  ),
  defective: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M10 2.3 18 16.3H2L10 2.3Z" strokeLinejoin="round" />
      <path d="M10 8v3.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <rect x="2.5" y="3.8" width="15" height="13.5" rx="1.5" strokeLinejoin="round" />
      <path d="M2.5 8h15M6 2v3.2M14 2v3.2" strokeLinecap="round" />
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <circle cx="10" cy="10" r="7.3" />
      <path d="M10 5.8v8.4M12.5 7.8c0-1-1.1-1.8-2.5-1.8s-2.4.8-2.4 1.8.9 1.4 2.4 1.7c1.6.3 2.5.8 2.5 1.9s-1.1 1.8-2.5 1.8-2.5-.6-2.5-1.7" strokeLinecap="round" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M3 16.5V3M3 16.5h14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13.5v-4M10 13.5v-7M14 13.5v-2.5" strokeLinecap="round" />
    </svg>
  ),
  auditLog: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M4 2.5h9l3 3v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M6.5 9h7M6.5 12h7M6.5 15h4.5" strokeLinecap="round" />
    </svg>
  ),
  apiKeys: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <circle cx="6.3" cy="13.7" r="3.3" />
      <path d="m8.6 11.4 7.9-7.9M13.5 6l2 2M16 3.5l2 2" strokeLinecap="round" />
    </svg>
  ),
  quickbooks: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.6" stroke="currentColor">
      <rect x="2" y="6.5" width="7" height="7" rx="3.5" />
      <rect x="11" y="6.5" width="7" height="7" rx="3.5" />
      <path d="M9 10h2" strokeLinecap="round" />
    </svg>
  ),
};

export function AppSidebar({
  navItems,
  fullName,
  roleName,
  userId,
}: {
  navItems: NavItem[];
  fullName: string;
  roleName: string;
  userId: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Navigating closes the mobile drawer -- otherwise it'd stay open,
  // covering the page just navigated to. Adjusted during render (React's
  // recommended pattern for this, not a useEffect, which would cause an
  // extra cascading render).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <>
      {/* Mobile-only top bar -- below md the full sidebar becomes a
          slide-in drawer instead of a permanently-visible 256px column,
          which would eat most of a phone screen. */}
      <div className="flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-sidebar-hover"
        >
          <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-base font-medium text-white">Inventory</p>
        <div className="w-9" aria-hidden="true" />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar md:static md:z-auto md:flex ${
          mobileOpen ? "flex" : "hidden"
        }`}
      >
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-white">Inventory</p>
              <p className="truncate text-xs text-sidebar-foreground-muted">Car accessories</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-white">{fullName}</p>
              <div className="flex items-center justify-end gap-1 text-xs text-sidebar-foreground-muted">
                <span className="min-w-0 truncate capitalize">{roleName}</span>
                <span className="shrink-0">·</span>
                <form action={signOut} className="shrink-0">
                  <button
                    type="submit"
                    className="shrink-0 text-primary underline underline-offset-2 hover:text-white"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-sidebar-foreground hover:bg-sidebar-hover md:hidden"
            >
              <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
                <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
              </svg>
            </button>
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-hover" />
            <NotificationBell userId={userId} />
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-active text-sidebar-active-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-hover"
                }`}
              >
                <span className="h-4 w-4 shrink-0">{icons[item.icon]}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
