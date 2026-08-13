import { redirect } from "next/navigation";
import { getCurrentUser, getPermissions } from "@/lib/auth/permissions";
import { AppSidebar } from "@/components/AppSidebar";
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
      <AppSidebar
        navItems={visibleNavItems}
        fullName={user.fullName}
        roleName={user.roleName}
      />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
