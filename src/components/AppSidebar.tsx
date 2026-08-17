"use client";

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
  | "users"
  | "roles"
  | "auditLog"
  | "apiKeys";
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

  return (
    <aside className="flex w-64 flex-col bg-sidebar">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-medium text-white">Inventory</p>
            <p className="text-xs text-sidebar-foreground-muted">Car accessories</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-hover" />
            <NotificationBell userId={userId} />
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-sidebar-hover px-4 py-3 text-right text-xs">
          <p className="truncate text-sm font-medium text-white">{fullName}</p>
          <p className="truncate capitalize text-sidebar-foreground-muted">{roleName}</p>
          <form action={signOut} className="mt-2">
            <button
              type="submit"
              className="text-primary underline underline-offset-2 hover:text-white"
            >
              Sign out
            </button>
          </form>
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
  );
}
