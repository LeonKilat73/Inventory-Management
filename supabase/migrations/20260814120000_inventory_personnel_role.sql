-- Renames the "viewer" (read-only) role into "inventory personnel" and
-- gives it real operational permissions: check (view), modify (edit),
-- restock (stock movements + PO receiving), repurchase (create/edit POs),
-- add (create items/bundles) -- everything short of manager/admin-only
-- authority (PO approval, supplier management, expenses/financial
-- reporting, user/role/API-key administration, and any delete action).

update roles
set name = 'inventory personnel',
    description = 'Day-to-day inventory operations: check, modify, restock, repurchase, and add stock/items. No approval, supplier, financial, or admin authority.'
where name = 'viewer';

delete from role_permissions
where role_id = (select id from roles where name = 'inventory personnel');

insert into role_permissions (role_id, module, action, allowed)
select r.id, v.module, v.action, true
from roles r
join (values
  ('items','view'), ('items','create'), ('items','edit'),
  ('bundles','view'), ('bundles','create'), ('bundles','edit'),
  ('suppliers','view'),
  ('purchase_orders','view'), ('purchase_orders','create'), ('purchase_orders','edit'), ('purchase_orders','receive'),
  ('stock_movements','view'), ('stock_movements','create'),
  ('defective_items','view'), ('defective_items','create'), ('defective_items','edit'),
  ('calendar','view'), ('calendar','create'),
  ('notifications','view')
) as v(module, action) on true
where r.name = 'inventory personnel';
