-- Sample data for local development only (applied by `supabase db reset`,
-- never run against production). Roles/permissions/module catalogs are
-- foundational and live in migrations instead -- see 20260813034630_roles_and_permissions.sql.
--
-- No demo login user is seeded here: sign up through the app's /login page.
-- The very first account to sign up automatically becomes admin (see the
-- handle_new_user trigger), so just sign up once and start there.

insert into categories (name) values
  ('GPS Navigation'),
  ('Dash Cams'),
  ('Backup Cameras'),
  ('Car Audio'),
  ('Mounts & Accessories');

insert into items (sku, name, description, category_id, unit_cost, unit_price, reorder_threshold, reorder_quantity)
select 'GPS-1000', 'Garmin-style 5" GPS Navigator', 'Entry-level touchscreen GPS unit', id, 45.00, 89.99, 5, 20
from categories where name = 'GPS Navigation'
union all
select 'DCAM-2000', '1080p Dual-Channel Dash Cam', 'Front + rear recording, night vision', id, 32.00, 69.99, 8, 25
from categories where name = 'Dash Cams'
union all
select 'DCAM-2100', '4K Single-Channel Dash Cam', 'Ultra HD front recording with GPS logging', id, 55.00, 119.99, 5, 15
from categories where name = 'Dash Cams'
union all
select 'BCAM-3000', 'Wireless Backup Camera Kit', 'Digital wireless rear-view camera', id, 28.00, 59.99, 6, 20
from categories where name = 'Backup Cameras'
union all
select 'MNT-5000', 'Windshield Suction Mount', 'Universal phone/GPS mount', id, 4.50, 12.99, 15, 50
from categories where name = 'Mounts & Accessories';

-- Demo bundle: dash cam + mount sold together at a combined price.
with bundle_item as (
  insert into items (sku, name, description, category_id, unit_price, is_bundle)
  select 'BNDL-DCAM-MNT', 'Dash Cam + Mount Bundle', 'Dual-channel dash cam bundled with a windshield mount', id, 74.99, true
  from categories where name = 'Dash Cams'
  returning id
)
insert into bundles (id, bundle_price)
select id, 74.99 from bundle_item;

insert into bundle_items (bundle_id, item_id, quantity)
select b.id, i.id, 1
from bundles b
join items bi on bi.id = b.id and bi.sku = 'BNDL-DCAM-MNT'
join items i on i.sku = 'DCAM-2000';

insert into bundle_items (bundle_id, item_id, quantity)
select b.id, i.id, 1
from bundles b
join items bi on bi.id = b.id and bi.sku = 'BNDL-DCAM-MNT'
join items i on i.sku = 'MNT-5000';

