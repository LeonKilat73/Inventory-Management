-- Bundles now reuse fn_next_sku too (see createBundle), but they're gated
-- on 'bundles' create, not 'items' create -- the function's internal
-- permission check was items-only, so a user with bundles:create but not
-- items:create (an unusual override, but possible) would have been wrongly
-- refused. Accept either. Otherwise identical to the brand-aware version in
-- 20260814100000_brand_subcategories.sql.
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
  if not (fn_has_permission(auth.uid(), 'items', 'create') or fn_has_permission(auth.uid(), 'bundles', 'create')) then
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
