export const MODULES = [
  "items",
  "bundles",
  "suppliers",
  "purchase_orders",
  "stock_movements",
  "defective_items",
  "calendar",
  "expenses",
  "notifications",
  "audit_log",
  "users",
  "roles",
  "api_keys",
] as const;

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "receive",
  "approve",
  "export",
] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];

export type PermissionMap = Record<Module, Partial<Record<Action, boolean>>>;

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  roleName: string;
  isActive: boolean;
};
