"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";

type NavItem = { href: string; label: string };

export function AppSidebar({
  navItems,
  fullName,
  roleName,
}: {
  navItems: NavItem[];
  fullName: string;
  roleName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col bg-surface-container-low">
      <div className="px-6 py-5">
        <p className="text-base font-medium text-on-surface">Inventory</p>
        <p className="text-xs text-on-surface-variant">Car accessories</p>
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
              className={`block rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 mb-4 mt-4 rounded-2xl bg-surface-container px-4 py-3 text-xs">
        <p className="truncate text-sm font-medium text-on-surface">{fullName}</p>
        <p className="truncate capitalize text-on-surface-variant">{roleName}</p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="text-primary underline underline-offset-2 hover:text-on-surface"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
