-- Lets a POS sale/return line override a bundle's fixed bundle_items recipe
-- with exactly what was actually used for that specific sale -- a part
-- skipped (customer's car already has it), or swapped for a different item
-- (JBL out of stock, sold MB Quart instead). The bundle's own price is
-- untouched either way; this only changes what stock actually moves.
--
-- Both functions: if the line's jsonb has a non-null 'constituents' array,
-- iterate that instead of querying bundle_items. No 'constituents' ->
-- unchanged fallback to the recipe, so any caller that doesn't know about
-- this (or an unmodified bundle sale) behaves exactly as before.

create or replace function fn_record_pos_sale(p_lines jsonb, p_reference uuid default null, p_note text default null)
returns table(movement_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_line_qty integer;
  v_item items%rowtype;
  v_constituent record;
  v_constituent_qty integer;
  v_current_stock integer;
  v_movement_id uuid;
  v_override jsonb;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart must have at least one line.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_qty := (v_line ->> 'quantity')::integer;
    if v_line_qty is null or v_line_qty <= 0 then
      raise exception 'Each line quantity must be positive.';
    end if;

    select * into v_item from items where id = (v_line ->> 'itemId')::uuid;
    if not found then
      raise exception 'Item % not found.', v_line ->> 'itemId';
    end if;

    if v_item.is_bundle then
      v_override := v_line -> 'constituents';

      if v_override is not null then
        for v_constituent in
          select (elem ->> 'itemId')::uuid as item_id, (elem ->> 'quantity')::integer as quantity
          from jsonb_array_elements(v_override) as elem
        loop
          v_constituent_qty := v_constituent.quantity * v_line_qty;

          select coalesce(sum(quantity_delta), 0) into v_current_stock
          from stock_movements where item_id = v_constituent.item_id;

          if v_current_stock - v_constituent_qty < 0 then
            raise exception 'Only % in stock -- can''t sell % of bundle %.',
              v_current_stock, v_line_qty, v_item.sku;
          end if;

          insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
          values (v_constituent.item_id, -v_constituent_qty, 'sale', 'pos_sale', p_reference, p_note)
          returning id into v_movement_id;

          movement_id := v_movement_id;
          return next;
        end loop;
      else
        for v_constituent in
          select bi.item_id, bi.quantity, i.sku
          from bundle_items bi
          join items i on i.id = bi.item_id
          where bi.bundle_id = v_item.id
        loop
          v_constituent_qty := v_constituent.quantity * v_line_qty;

          select coalesce(sum(quantity_delta), 0) into v_current_stock
          from stock_movements where item_id = v_constituent.item_id;

          if v_current_stock - v_constituent_qty < 0 then
            raise exception 'Only % of % in stock -- can''t sell % of bundle %.',
              v_current_stock, v_constituent.sku, v_line_qty, v_item.sku;
          end if;

          insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
          values (v_constituent.item_id, -v_constituent_qty, 'sale', 'pos_sale', p_reference, p_note)
          returning id into v_movement_id;

          movement_id := v_movement_id;
          return next;
        end loop;
      end if;
    else
      select coalesce(sum(quantity_delta), 0) into v_current_stock
      from stock_movements where item_id = v_item.id;

      if v_current_stock - v_line_qty < 0 then
        raise exception 'Only % of % in stock -- can''t sell %.', v_current_stock, v_item.sku, v_line_qty;
      end if;

      insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
      values (v_item.id, -v_line_qty, 'sale', 'pos_sale', p_reference, p_note)
      returning id into v_movement_id;

      movement_id := v_movement_id;
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function fn_record_pos_sale(jsonb, uuid, text) to service_role;

create or replace function fn_partial_return_pos_sale(p_reference uuid, p_lines jsonb, p_note text default null)
returns table(movement_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_line_qty integer;
  v_item items%rowtype;
  v_constituent record;
  v_constituent_qty integer;
  v_already_sold integer;
  v_already_returned integer;
  v_new_id uuid;
  v_override jsonb;
begin
  if p_reference is null then
    raise exception 'A reference id is required.';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one return line is required.';
  end if;

  if exists (
    select 1 from stock_movements
    where reference_table = 'pos_sale_void' and reference_id = p_reference
  ) then
    raise exception 'This sale was already fully voided.';
  end if;

  if not exists (
    select 1 from stock_movements
    where reference_table = 'pos_sale' and reference_id = p_reference and movement_type = 'sale'
  ) then
    raise exception 'No sale found for that reference.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_qty := (v_line ->> 'quantity')::integer;
    if v_line_qty is null or v_line_qty <= 0 then
      raise exception 'Each return line quantity must be positive.';
    end if;

    select * into v_item from items where id = (v_line ->> 'itemId')::uuid;
    if not found then
      raise exception 'Item % not found.', v_line ->> 'itemId';
    end if;

    if v_item.is_bundle then
      v_override := v_line -> 'constituents';

      if v_override is not null then
        for v_constituent in
          select (elem ->> 'itemId')::uuid as item_id, (elem ->> 'quantity')::integer as quantity
          from jsonb_array_elements(v_override) as elem
        loop
          v_constituent_qty := v_constituent.quantity * v_line_qty;

          select coalesce(sum(-quantity_delta), 0) into v_already_sold
          from stock_movements
          where item_id = v_constituent.item_id and reference_table = 'pos_sale'
            and reference_id = p_reference and movement_type = 'sale';

          select coalesce(sum(quantity_delta), 0) into v_already_returned
          from stock_movements
          where item_id = v_constituent.item_id and reference_table = 'pos_sale_return'
            and reference_id = p_reference and movement_type = 'replacement_in';

          if v_already_returned + v_constituent_qty > v_already_sold then
            raise exception 'Can''t return % of that bundle constituent -- only % remaining from this sale.',
              v_constituent_qty, greatest(v_already_sold - v_already_returned, 0);
          end if;

          insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
          values (v_constituent.item_id, v_constituent_qty, 'replacement_in', 'pos_sale_return', p_reference, p_note)
          returning id into v_new_id;

          movement_id := v_new_id;
          return next;
        end loop;
      else
        for v_constituent in
          select bi.item_id, bi.quantity, i.sku
          from bundle_items bi
          join items i on i.id = bi.item_id
          where bi.bundle_id = v_item.id
        loop
          v_constituent_qty := v_constituent.quantity * v_line_qty;

          select coalesce(sum(-quantity_delta), 0) into v_already_sold
          from stock_movements
          where item_id = v_constituent.item_id and reference_table = 'pos_sale'
            and reference_id = p_reference and movement_type = 'sale';

          select coalesce(sum(quantity_delta), 0) into v_already_returned
          from stock_movements
          where item_id = v_constituent.item_id and reference_table = 'pos_sale_return'
            and reference_id = p_reference and movement_type = 'replacement_in';

          if v_already_returned + v_constituent_qty > v_already_sold then
            raise exception 'Can''t return % of % -- only % remaining from this sale.',
              v_constituent_qty, v_constituent.sku, greatest(v_already_sold - v_already_returned, 0);
          end if;

          insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
          values (v_constituent.item_id, v_constituent_qty, 'replacement_in', 'pos_sale_return', p_reference, p_note)
          returning id into v_new_id;

          movement_id := v_new_id;
          return next;
        end loop;
      end if;
    else
      select coalesce(sum(-quantity_delta), 0) into v_already_sold
      from stock_movements
      where item_id = v_item.id and reference_table = 'pos_sale'
        and reference_id = p_reference and movement_type = 'sale';

      select coalesce(sum(quantity_delta), 0) into v_already_returned
      from stock_movements
      where item_id = v_item.id and reference_table = 'pos_sale_return'
        and reference_id = p_reference and movement_type = 'replacement_in';

      if v_already_returned + v_line_qty > v_already_sold then
        raise exception 'Can''t return % of % -- only % remaining from this sale.',
          v_line_qty, v_item.sku, greatest(v_already_sold - v_already_returned, 0);
      end if;

      insert into stock_movements (item_id, quantity_delta, movement_type, reference_table, reference_id, note)
      values (v_item.id, v_line_qty, 'replacement_in', 'pos_sale_return', p_reference, p_note)
      returning id into v_new_id;

      movement_id := v_new_id;
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function fn_partial_return_pos_sale(uuid, jsonb, text) to service_role;
