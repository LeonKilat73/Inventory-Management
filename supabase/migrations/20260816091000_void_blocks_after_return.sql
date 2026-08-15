-- fn_void_pos_sale reverses the *original* full sale quantities
-- unconditionally. If a partial return (fn_partial_return_pos_sale) has
-- already happened against the same reference, voiding on top of that
-- would add back the full original quantity a second time -- double-
-- crediting stock for whatever was already returned. Block voiding once
-- any partial return exists for the reference; staff use further partial
-- returns to reverse anything additional instead of mixing the two paths.
create or replace function fn_void_pos_sale(p_reference uuid)
returns table(movement_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement record;
  v_new_id uuid;
  v_found boolean := false;
begin
  if p_reference is null then
    raise exception 'A reference id is required.';
  end if;

  if exists (
    select 1 from stock_movements
    where reference_table = 'pos_sale_void' and reference_id = p_reference
  ) then
    raise exception 'This sale has already been voided.';
  end if;

  if exists (
    select 1 from stock_movements
    where reference_table = 'pos_sale_return' and reference_id = p_reference
  ) then
    raise exception 'This sale already has partial returns against it -- use returns to reverse the rest instead of voiding.';
  end if;

  for v_movement in
    select item_id, quantity_delta
    from stock_movements
    where reference_table = 'pos_sale' and reference_id = p_reference and movement_type = 'sale'
  loop
    v_found := true;

    insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
    values (v_movement.item_id, -v_movement.quantity_delta, 'replacement_in', 'pos_sale_void', p_reference, 'Void of POS sale')
    returning id into v_new_id;

    movement_id := v_new_id;
    return next;
  end loop;

  if not v_found then
    raise exception 'No sale found for that reference.';
  end if;
end;
$$;

grant execute on function fn_void_pos_sale(uuid) to service_role;
