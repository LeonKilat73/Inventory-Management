-- Reverses a POS sale: for every 'sale' stock_movements row tagged with a
-- given pos_sale reference, posts an offsetting 'replacement_in' row (the
-- existing, semantically-correct type for "stock came back") for the same
-- item/quantity. Atomic like fn_record_pos_sale -- either every line
-- reverses or none do. Reversal rows are tagged reference_table =
-- 'pos_sale_void' (not 'pos_sale') so this same function can cheaply check
-- "has this reference already been voided" without a separate table, and so
-- a voided sale's original movements stay untouched/auditable.
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
