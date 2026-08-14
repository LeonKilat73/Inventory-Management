import { redirect } from "next/navigation";
import { getCurrentUser, getPermissions } from "@/lib/auth/permissions";
import { AppSidebar, type NavIcon } from "@/components/AppSidebar";
import type { Module } from "@/lib/auth/types";

const NAV_ITEMS: { href: string; label: string; module: Module | null; icon: NavIcon }[] = [
  { href: "/dashboard", label: "Dashboard", module: null, icon: "dashboard" },
  { href: "/items", label: "Items", module: "items", icon: "items" },
  { href: "/items/bundles", label: "Bundles", module: "bundles", icon: "bundles" },
  { href: "/suppliers", label: "Suppliers", module: "suppliers", icon: "suppliers" },
  { href: "/purchase-orders", label: "Purchase Orders", module: "purchase_orders", icon: "purchaseOrders" },
  { href: "/stock/movements", label: "Stock Movements", module: "stock_movements", icon: "stock" },
  { href: "/stock/defective", label: "Defective Items", module: "defective_items", icon: "defective" },
  { href: "/calendar", label: "Calendar", module: "calendar", icon: "calendar" },
  { href: "/expenses", label: "Expenses", module: "expenses", icon: "expenses" },
  { href: "/admin/users", label: "Users", module: "users", icon: "users" },
  { href: "/admin/roles", label: "Roles", module: "roles", icon: "roles" },
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
