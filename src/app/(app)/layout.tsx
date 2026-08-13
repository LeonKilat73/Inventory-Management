import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getPermissions } from "@/lib/auth/permissions";
import { signOut } from "@/actions/auth";
import type { Module } from "@/lib/auth/types";

const NAV_ITEMS: { href: string; label: string; module: Module | null }[] = [
  { href: "/dashboard", label: "Dashboard", module: null },
  { href: "/items", label: "Items", module: "items" },
  { href: "/items/bundles", label: "Bundles", module: "bundles" },
  { href: "/admin/users", label: "Users", module: "users" },
  { href: "/admin/roles", label: "Roles", module: "roles" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const permissions = await getPermissions();
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.module === null || permissions[item.module]?.view === true,
  );

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 flex-col border-r border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
        <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
          <p className="text-sm font-semibold text-foreground">Inventory</p>
          <p className="text-xs text-zinc-500">Car accessories</p>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-black/10 px-4 py-4 text-xs text-zinc-500 dark:border-white/10">
          <p className="truncate font-medium text-foreground">{user.fullName}</p>
          <p className="truncate capitalize">{user.roleName}</p>
          <form action={signOut} className="mt-2">
            <button
              type="submit"
              className="text-zinc-500 underline underline-offset-2 hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
