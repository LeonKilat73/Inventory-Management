-- Partial-return sibling of fn_void_pos_sale: reverses specific line(s) of a
-- POS sale by quantity, not the whole sale. A bundle line expands into its
-- constituents the same way fn_record_pos_sale does at sale time. Guards
-- against returning more than was actually sold (minus whatever's already
-- been returned) per item, by comparing against the original 'pos_sale'
-- movements for the same reference -- so two partial returns against the
-- same sale can't together exceed what was sold, and a return can't happen
-- at all once the sale's been fully voided (fn_void_pos_sale already
-- reversed everything).
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
