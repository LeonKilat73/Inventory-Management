-- Per-category SKU auto-generation: each category gets an optional prefix
-- and an atomically-incrementing counter, so new items can get a
-- system-generated SKU like "DCAM-2101" instead of requiring manual entry.

alter table categories
  add column sku_prefix text,
  add column sku_next_number integer not null default 1;

alter table categories
  add constraint categories_sku_prefix_format check (sku_prefix is null or sku_prefix ~ '^[A-Z0-9]{1,10}$');

create unique index categories_sku_prefix_key on categories (sku_prefix) where sku_prefix is not null;

-- Atomically claims and returns the next SKU for a category, e.g. 'DCAM-2101'.
-- Returns null if the category has no prefix configured, so callers can fall
-- back to requiring a manual SKU. security definer + the counter UPDATE in
-- one statement keeps concurrent claims from handing out the same number.
create or replace function fn_next_sku(p_category_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_number integer;
begin
  if not fn_has_permission(auth.uid(), 'items', 'create') then
    raise exception 'Permission denied';
  end if;

  update categories
  set sku_next_number = sku_next_number + 1
  where id = p_category_id and sku_prefix is not null
  returning sku_prefix, sku_next_number - 1 into v_prefix, v_number;

  if v_prefix is null then
    return null;
  end if;

  return v_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;

grant execute on function fn_next_sku(uuid) to authenticated;
