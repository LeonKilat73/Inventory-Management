-- Brand-level sub-categories: a category can now have one level of children
-- (e.g. "Dash Cams" -> "QCY", "Lenovo"), each with its own SKU prefix and
-- independently-incrementing counter. A child's generated SKU combines its
-- parent's prefix with its own: parent "DCAM" + child "QCY" -> "DCAM-QCY-0001".
-- categories.parent_id already existed in the original schema but was never
-- used by the app until now.

-- name was globally unique; replace with "unique among top-level categories"
-- + "unique within a given parent" so the same brand name (e.g. "QCY") can
-- exist under two different parent categories without colliding.
alter table categories drop constraint categories_name_key;

create unique index categories_name_top_level_key on categories (name) where parent_id is null;
create unique index categories_name_per_parent_key on categories (parent_id, name) where parent_id is not null;

-- Only one level of nesting -- a brand can't itself have brands under it.
create or replace function fn_prevent_deep_category_nesting() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from categories where id = new.parent_id and parent_id is not null) then
      raise exception 'Categories can only nest one level deep.';
    end if;
    if exists (select 1 from categories where parent_id = new.id) then
      raise exception 'This category already has sub-categories of its own and cannot be nested under another.';
    end if;
  end if;
  return new;
end;
$$;

create trigger prevent_deep_category_nesting
  before insert or update on categories
  for each row execute function fn_prevent_deep_category_nesting();

-- Composes the parent's prefix in when generating a SKU for a brand
-- sub-category, e.g. "DCAM-QCY-0001" instead of just "QCY-0001". Top-level
-- categories (parent_id is null) behave exactly as before.
create or replace function fn_next_sku(p_category_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_own_prefix text;
  v_parent_prefix text;
  v_number integer;
begin
  if not fn_has_permission(auth.uid(), 'items', 'create') then
    raise exception 'Permission denied';
  end if;

  update categories
  set sku_next_number = sku_next_number + 1
  where id = p_category_id and sku_prefix is not null
  returning sku_prefix, sku_next_number - 1 into v_own_prefix, v_number;

  if v_own_prefix is null then
    return null;
  end if;

  select p.sku_prefix into v_parent_prefix
  from categories c
  join categories p on p.id = c.parent_id
  where c.id = p_category_id;

  if v_parent_prefix is not null then
    return v_parent_prefix || '-' || v_own_prefix || '-' || lpad(v_number::text, 4, '0');
  end if;

  return v_own_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;
