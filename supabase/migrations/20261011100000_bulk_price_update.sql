-- Bulk price / cost update from a spreadsheet. About 400 active items have no
-- price (and QuickBooks doesn't have them either), so the owner has to supply
-- them -- one item at a time through the edit form is not realistic.
--
-- One security-definer function does the whole import atomically, and does it
-- in two modes: p_apply = false only reports what WOULD change (a preview),
-- p_apply = true writes it. Each changed item is still audited individually
-- (attributed to the signed-in user); the per-item "Item updated"
-- notifications are suppressed for the duration and replaced with ONE summary
-- notification, otherwise a 400-row import would put 400 alerts in every
-- admin's bell.

create or replace function fn_notify_item_modified() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.bulk_item_update', true), '') = '1' then
    return new;
  end if;

  if (to_jsonb(new) - 'updated_at' - 'quickbooks_synced_at' - 'quickbooks_id')
     is distinct from
     (to_jsonb(old) - 'updated_at' - 'quickbooks_synced_at' - 'quickbooks_id') then
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    select p.id, 'item_modified', 'Item updated: ' || new.name, new.sku || ' was modified.',
           'items', new.id
    from profiles p
    join roles r on r.id = p.role_id
    left join notification_preferences np on np.user_id = p.id
    where p.is_active and (r.name = 'admin' or coalesce(np.item_modified_alerts, false));
  end if;
  return new;
end;
$$;

create function fn_bulk_update_item_prices(p_rows jsonb, p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row         jsonb;
  v_idx         integer := 0;
  v_sku         text;
  v_item        items%rowtype;
  v_has_price   boolean;
  v_has_cost    boolean;
  v_price       numeric;
  v_cost        numeric;
  v_new_price   numeric;
  v_new_cost    numeric;
  v_seen        text[] := '{}';
  v_updated     integer := 0;
  v_unchanged   integer := 0;
  v_will_change integer := 0;
  v_not_found   jsonb := '[]'::jsonb;
  v_not_found_n integer := 0;
  v_invalid     jsonb := '[]'::jsonb;
  v_invalid_n   integer := 0;
  v_bundles     jsonb := '[]'::jsonb;
  v_bundles_n   integer := 0;
  v_sample      jsonb := '[]'::jsonb;
  v_who         text;
begin
  if not fn_has_permission(auth.uid(), 'items', 'edit') then
    raise exception 'You do not have permission to edit items.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'There are no rows to import.';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'That file has more than 5000 rows. Split it into smaller files.';
  end if;

  if p_apply then
    perform set_config('app.bulk_item_update', '1', true);
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_sku := nullif(trim(coalesce(v_row ->> 'sku', '')), '');

    if v_sku is null then
      v_invalid_n := v_invalid_n + 1;
      if v_invalid_n <= 50 then v_invalid := v_invalid || jsonb_build_object('row', v_idx, 'sku', null, 'reason', 'Missing SKU'); end if;
      continue;
    end if;

    if lower(v_sku) = any (v_seen) then
      v_invalid_n := v_invalid_n + 1;
      if v_invalid_n <= 50 then v_invalid := v_invalid || jsonb_build_object('row', v_idx, 'sku', v_sku, 'reason', 'This SKU appears more than once in the file'); end if;
      continue;
    end if;
    v_seen := v_seen || lower(v_sku);

    v_has_price := nullif(trim(coalesce(v_row ->> 'price', '')), '') is not null;
    v_has_cost  := nullif(trim(coalesce(v_row ->> 'cost', '')), '') is not null;

    if not v_has_price and not v_has_cost then
      v_invalid_n := v_invalid_n + 1;
      if v_invalid_n <= 50 then v_invalid := v_invalid || jsonb_build_object('row', v_idx, 'sku', v_sku, 'reason', 'No price or cost given'); end if;
      continue;
    end if;

    begin
      if v_has_price then v_price := round((v_row ->> 'price')::numeric, 2); end if;
      if v_has_cost  then v_cost  := round((v_row ->> 'cost')::numeric, 2);  end if;
    exception when others then
      v_invalid_n := v_invalid_n + 1;
      if v_invalid_n <= 50 then v_invalid := v_invalid || jsonb_build_object('row', v_idx, 'sku', v_sku, 'reason', 'Price or cost isn''t a number'); end if;
      continue;
    end;

    if (v_has_price and (v_price < 0 or v_price > 9999999.99))
       or (v_has_cost and (v_cost < 0 or v_cost > 9999999.99)) then
      v_invalid_n := v_invalid_n + 1;
      if v_invalid_n <= 50 then v_invalid := v_invalid || jsonb_build_object('row', v_idx, 'sku', v_sku, 'reason', 'Price or cost is negative or unreasonably large'); end if;
      continue;
    end if;

    select * into v_item from items where lower(sku) = lower(v_sku);
    if not found then
      v_not_found_n := v_not_found_n + 1;
      if v_not_found_n <= 50 then v_not_found := v_not_found || to_jsonb(v_sku); end if;
      continue;
    end if;

    -- A bundle's price lives in two places (items and bundles); it is edited
    -- on the Bundles page so the two can't drift apart.
    if v_item.is_bundle then
      v_bundles_n := v_bundles_n + 1;
      if v_bundles_n <= 50 then v_bundles := v_bundles || to_jsonb(v_sku); end if;
      continue;
    end if;

    v_new_price := case when v_has_price then v_price else v_item.unit_price end;
    v_new_cost  := case when v_has_cost  then v_cost  else v_item.unit_cost  end;

    if v_new_price is not distinct from v_item.unit_price and v_new_cost is not distinct from v_item.unit_cost then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    v_will_change := v_will_change + 1;
    if jsonb_array_length(v_sample) < 25 then
      v_sample := v_sample || jsonb_build_object(
        'sku', v_item.sku, 'name', v_item.name,
        'oldPrice', v_item.unit_price, 'newPrice', v_new_price,
        'oldCost', v_item.unit_cost, 'newCost', v_new_cost
      );
    end if;

    if p_apply then
      update items set unit_price = v_new_price, unit_cost = v_new_cost where id = v_item.id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  if p_apply and v_updated > 0 then
    select coalesce(full_name, email) into v_who from profiles where id = auth.uid();
    insert into notifications (user_id, type, title, body, reference_table, reference_id)
    select p.id, 'system', 'Prices updated: ' || v_updated || ' item' || case when v_updated = 1 then '' else 's' end,
           coalesce(v_who, 'Someone') || ' imported new prices from a spreadsheet.', null, null
    from profiles p
    join roles r on r.id = p.role_id
    where p.is_active and r.name = 'admin';
  end if;

  return jsonb_build_object(
    'applied', p_apply,
    'rows', v_idx,
    'willChange', v_will_change,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'notFound', v_not_found, 'notFoundCount', v_not_found_n,
    'invalid', v_invalid, 'invalidCount', v_invalid_n,
    'bundles', v_bundles, 'bundlesCount', v_bundles_n,
    'sample', v_sample
  );
end;
$$;

-- Callable by signed-in users only (the permission is checked inside), never
-- by anonymous visitors.
revoke execute on function fn_bulk_update_item_prices(jsonb, boolean) from public, anon;
grant execute on function fn_bulk_update_item_prices(jsonb, boolean) to authenticated;
